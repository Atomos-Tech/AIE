'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, BookOpen, Trophy, RotateCcw, MapPin, Zap, RefreshCw, AlertCircle, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import MasteryIndicator from './MasteryIndicator';
import PostQuizRecommendations from './PostQuizRecommendations';
import LearningPath from './LearningPath';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

type Difficulty = 'easy' | 'medium' | 'hard';

interface QuizQuestion {
    id: string;
    text: string;
    options: { id: string; text: string }[];
    correct_option_id: string;
    explanation: string;
    source_chunk_id?: string;
    related_concept?: string;
    difficulty?: Difficulty;
    difficulty_score?: number;
}

interface QuestionResult {
    question_id: string;
    related_concept: string;
    correct: boolean;
}

interface RecommendationData {
    path_type: string;
    score_pct: number;
    remediation: any[];
    advancement: any[];
    summary: string;
}

interface Quiz {
    id: string;
    title: string;
    questions: QuizQuestion[];
    average_difficulty?: number;
}

interface AdaptiveQuiz extends Quiz {
    student_mastery: number;
    target_difficulty: Difficulty;
    adapted: boolean;
}

const DifficultyBadge = ({ difficulty }: { difficulty?: Difficulty }) => {
    if (!difficulty) return null;

    const badges = {
        easy: {
            bg: 'bg-green-100',
            text: 'text-green-700',
            border: 'border-green-200',
            label: 'Easy'
        },
        medium: {
            bg: 'bg-yellow-100',
            text: 'text-yellow-700',
            border: 'border-yellow-200',
            label: 'Medium'
        },
        hard: {
            bg: 'bg-red-100',
            text: 'text-red-700',
            border: 'border-red-200',
            label: 'Hard'
        }
    };

    const badge = badges[difficulty];

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
            {badge.label}
        </span>
    );
};

// Subject-specific topic lists — curated to match OpenStax textbook content
const SUBJECT_TOPICS: Record<string, { value: string; label: string }[]> = {
    us_history: [
        { value: 'The American Revolution', label: 'The American Revolution' },
        { value: 'The Constitution', label: 'The Constitution' },
        { value: 'Colonial America', label: 'Colonial America' },
        { value: 'The Civil War', label: 'The Civil War' },
        { value: 'Industrialization', label: 'Industrialization' },
        { value: 'Westward Expansion', label: 'Westward Expansion' },
        { value: 'World War II', label: 'World War II' },
        { value: 'The Great Depression', label: 'The Great Depression' },
        { value: 'Civil Rights Movement', label: 'Civil Rights Movement' },
        { value: 'Cold War', label: 'Cold War' },
        { value: 'Slavery and Abolition', label: 'Slavery and Abolition' },
        { value: 'Immigration and Urbanization', label: 'Immigration and Urbanization' },
    ],
    economics: [
        { value: 'Supply and Demand', label: 'Supply and Demand' },
        { value: 'Market Equilibrium', label: 'Market Equilibrium' },
        { value: 'Fiscal Policy', label: 'Fiscal Policy' },
        { value: 'Monetary Policy', label: 'Monetary Policy' },
        { value: 'International Trade', label: 'International Trade' },
        { value: 'Monopoly and Competition', label: 'Monopoly and Competition' },
        { value: 'Inflation and Unemployment', label: 'Inflation and Unemployment' },
        { value: 'GDP and Economic Growth', label: 'GDP and Economic Growth' },
        { value: 'Labor Markets', label: 'Labor Markets' },
        { value: 'Poverty and Inequality', label: 'Poverty and Inequality' },
    ],
    biology: [
        { value: 'Cell Structure and Function', label: 'Cell Structure and Function' },
        { value: 'Photosynthesis', label: 'Photosynthesis' },
        { value: 'DNA and Genetics', label: 'DNA and Genetics' },
        { value: 'Evolution and Natural Selection', label: 'Evolution and Natural Selection' },
        { value: 'Ecology and Ecosystems', label: 'Ecology and Ecosystems' },
    ],
    world_history: [
        { value: 'Ancient Civilizations', label: 'Ancient Civilizations' },
        { value: 'The Roman Empire', label: 'The Roman Empire' },
        { value: 'The Renaissance', label: 'The Renaissance' },
        { value: 'World War I', label: 'World War I' },
        { value: 'Colonialism and Imperialism', label: 'Colonialism and Imperialism' },
    ],
};

const DEFAULT_TOPICS = SUBJECT_TOPICS.us_history;

export default function Quiz() {
    const router = useRouter();
    const [topic, setTopic] = useState('The American Revolution');
    const [customTopic, setCustomTopic] = useState('');
    const [quiz, setQuiz] = useState<AdaptiveQuiz | Quiz | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);

    // The actual topic being quizzed (resolved from dropdown or custom input)
    const [activeTopic, setActiveTopic] = useState('The American Revolution');

    // Adaptive mode state
    const [adaptiveMode, setAdaptiveMode] = useState(true);
    const [currentMastery, setCurrentMastery] = useState(0.3);
    const [targetDifficulty, setTargetDifficulty] = useState<Difficulty>('easy');

    // Post-quiz recommendations state
    const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
    const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
    const [recsLoading, setRecsLoading] = useState(false);
    const [recsError, setRecsError] = useState<string | null>(null);

    // Inline error/notice state (replaces alert())
    const [formError, setFormError] = useState<string | null>(null);
    const [resetNotice, setResetNotice] = useState(false);

    // Get mastery tracking from store
    const {
        updateMastery,
        setHighlightedConcepts,
        loadMasteryFromBackend,
        resetMasteryOnBackend,
        getMastery,
        currentSubject,
        masteryMap,
    } = useAppStore();

    // Get topics for the current subject
    const subjectTopics = SUBJECT_TOPICS[currentSubject] || DEFAULT_TOPICS;

    // Reset topic and quiz state when subject changes
    useEffect(() => {
        const topics = SUBJECT_TOPICS[currentSubject] || DEFAULT_TOPICS;
        setTopic(topics[0].value);
        setCustomTopic('');
        // Reset any in-progress quiz so stale data from a different subject isn't shown
        setQuiz(null);
        setShowResults(false);
        setCurrentQuestionIndex(0);
        setScore(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setQuestionResults([]);
        setRecommendations(null);
        setFormError(null);
    }, [currentSubject]);

    // Load mastery from backend on mount
    useEffect(() => {
        loadMasteryFromBackend();
    }, [loadMasteryFromBackend]);

    // Close results modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showResults) {
                handleRetry();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showResults]); // eslint-disable-line react-hooks/exhaustive-deps

    // Update local mastery display when topic changes or store updates (e.g. BKT backend sync)
    useEffect(() => {
        const displayTopic = activeTopic || (topic === '__custom__' ? customTopic.trim() : topic);
        const mastery = getMastery(displayTopic || topic);
        setCurrentMastery(mastery);
        // Determine target difficulty
        if (mastery < 0.4) setTargetDifficulty('easy');
        else if (mastery <= 0.7) setTargetDifficulty('medium');
        else setTargetDifficulty('hard');
    }, [topic, customTopic, activeTopic, getMastery, masteryMap]);

    const handleStartQuiz = async () => {
        const effectiveTopic = topic === '__custom__' ? customTopic.trim() : topic;
        if (!effectiveTopic) {
            setFormError('Please enter a topic.');
            return;
        }
        setFormError(null);
        setActiveTopic(effectiveTopic);
        setIsLoading(true);
        try {
            let data;

            if (adaptiveMode) {
                // Use adaptive endpoint
                const res = await fetch(
                    `${API_BASE}${API_PREFIX}/quiz/generate-adaptive?topic=${encodeURIComponent(effectiveTopic)}&num_questions=3&subject=${encodeURIComponent(currentSubject)}`,
                    { method: 'POST' }
                );
                if (!res.ok) {
                    const errBody = await res.text();
                    throw new Error(`Quiz generation failed (${res.status}): ${errBody}`);
                }
                data = await res.json() as AdaptiveQuiz;

                // Update local state with backend's mastery info
                setCurrentMastery(data.student_mastery);
                setTargetDifficulty(data.target_difficulty);
            } else {
                // Use standard endpoint
                const res = await fetch(
                    `${API_BASE}${API_PREFIX}/quiz/generate?topic=${encodeURIComponent(effectiveTopic)}&num_questions=3&subject=${encodeURIComponent(currentSubject)}`,
                    { method: 'POST' }
                );
                if (!res.ok) {
                    const errBody = await res.text();
                    throw new Error(`Quiz generation failed (${res.status}): ${errBody}`);
                }
                data = await res.json() as Quiz;
            }

            if (!data.questions || data.questions.length === 0) {
                throw new Error('Quiz generated with no questions. Try a different topic.');
            }

            setQuiz(data);
            setCurrentQuestionIndex(0);
            setScore(0);
            setIsSubmitted(false);
            setSelectedOption(null);
        } catch (error) {
            console.error("Failed to generate quiz", error);
            setFormError("Failed to generate quiz. Please ensure the backend is running.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptionSelect = (optionId: string) => {
        if (!isSubmitted) {
            setSelectedOption(optionId);
        }
    };

    const handleSubmitAnswer = () => {
        if (!selectedOption || isSubmitted) return;
        setIsSubmitted(true);

        const currentQ = quiz?.questions[currentQuestionIndex];
        const isCorrect = selectedOption === currentQ?.correct_option_id;

        if (isCorrect) {
            setScore(s => s + 1);
        }

        // Track question result for recommendations
        setQuestionResults(prev => [
            ...prev,
            {
                question_id: currentQ?.id || '',
                related_concept: currentQ?.related_concept || activeTopic,
                correct: isCorrect,
            },
        ]);

        // Update mastery tracking for the topic (syncs to backend via BKT)
        updateMastery(activeTopic, isCorrect);
    };

    const handleNextQuestion = () => {
        if (!quiz) return;
        if (currentQuestionIndex < quiz.questions?.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
        } else {
            // Quiz finished - show results modal
            setShowResults(true);
            // Fetch recommendations asynchronously
            fetchRecommendations();
        }
    };

    const fetchRecommendations = async () => {
        setRecsLoading(true);
        setRecsError(null);
        try {
            const res = await fetch(`${API_BASE}${API_PREFIX}/quiz/recommendations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: activeTopic,
                    question_results: questionResults,
                    student_id: 'default',
                    subject: currentSubject,
                }),
            });
            if (!res.ok) {
                throw new Error(`Failed to fetch recommendations (${res.status})`);
            }
            const data = await res.json();
            setRecommendations(data);
        } catch (err) {
            console.error('Failed to fetch recommendations:', err);
            setRecsError('Unable to load recommendations. Your score and results are still available above.');
        } finally {
            setRecsLoading(false);
        }
    };

    const handleRetry = () => {
        setQuiz(null);
        setShowResults(false);
        setCurrentQuestionIndex(0);
        setScore(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setQuestionResults([]);
        setRecommendations(null);
        setRecsError(null);
        setFormError(null);
    };

    const handleResetProfile = async () => {
        await resetMasteryOnBackend();
        setCurrentMastery(0.3);
        setTargetDifficulty('easy');
        setResetNotice(true);
        setTimeout(() => setResetNotice(false), 3000);
    };

    const handleViewLearningPath = () => {
        // Set highlighted concepts before navigating to graph
        setHighlightedConcepts([activeTopic]);
        router.push('/graph');
    };

    const handlePracticeConcept = (concept: string) => {
        handleRetry();
        setTopic(concept);
    };

    const handleAskTutor = (concept: string) => {
        router.push(`/chat?question=${encodeURIComponent(`Explain ${concept}`)}`);
    };

    // Check if quiz is adaptive
    const isAdaptiveQuiz = (q: Quiz | AdaptiveQuiz | null): q is AdaptiveQuiz => {
        return q !== null && 'adapted' in q && q.adapted === true;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-950 rounded-md border border-slate-800 shadow-2xl">
                {/* Animated quiz generation indicator */}
                <div className="relative mb-6">
                    <Loader2 className="w-12 h-12 animate-spin text-violet-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-violet-400 font-mono text-xs">{`{}`}</span>
                    </div>
                </div>

                <h3 className="text-lg font-mono font-medium text-slate-200 mb-2">
                    {adaptiveMode ? '// Compiling personalized assessment...' : '// Initializing generic assessment...'}
                </h3>

                {/* Progress steps */}
                <div className="space-y-3 text-sm text-slate-500 mb-6 font-mono w-full max-w-sm">
                    <div className="flex items-center gap-3">
                        <span className="text-emerald-500 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4" />
                        </span>
                        <span>[OK] Knowledge graph traversal</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-violet-500 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </span>
                        <span>
                            {adaptiveMode
                                ? `[WAIT] Generating ${targetDifficulty}-level artifacts...`
                                : '[WAIT] Synthesizing queries...'}
                        </span>
                    </div>
                </div>

                <div className="bg-slate-900 w-full max-w-sm p-4 rounded-md border border-slate-800">
                    <p className="text-xs font-mono text-slate-400 mb-2">
                        <span className="text-violet-500">const</span> topic = <span className="text-emerald-400">"{activeTopic}"</span>;
                    </p>
                    {adaptiveMode && (
                        <p className="text-xs font-mono text-slate-400">
                            <span className="text-violet-500">const</span> mastery = <span className="text-fuchsia-400">{Math.round(currentMastery * 100)}</span>; // Target: {targetDifficulty}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="max-w-md mx-auto bg-slate-950 p-8 rounded-md shadow-2xl border border-slate-800 font-sans">
                <div className="flex items-center gap-3 mb-8">
                    <span className="text-violet-500 font-mono text-xl">{`>`}</span>
                    <h2 className="text-xl font-semibold text-slate-100">Initialize Assessment</h2>
                </div>

                {/* Adaptive Mode Toggle */}
                <div className="mb-6 p-4 bg-slate-900 rounded-md border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-violet-400" />
                            <span className="font-medium text-slate-200 text-sm font-mono">Adaptive Mode</span>
                        </div>
                        <button
                            onClick={() => setAdaptiveMode(!adaptiveMode)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                                adaptiveMode ? 'bg-violet-600' : 'bg-slate-700'
                            }`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${
                                    adaptiveMode ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-2">
                        // {adaptiveMode
                            ? 'Questions dynamically calibrate to user competency.'
                            : 'Static difficulty spectrum across generic concepts.'}
                    </p>
                </div>

                {/* Topic Selection */}
                <div className="mb-6">
                    <label className="block text-xs font-mono text-slate-400 mb-2">Target Concept</label>
                    <select
                        value={topic}
                        onChange={(e) => {
                            setTopic(e.target.value);
                            if (e.target.value !== '__custom__') setCustomTopic('');
                        }}
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-1 focus:ring-violet-500 outline-none transition-all font-mono"
                    >
                        {subjectTopics.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                        <option value="__custom__">Custom concept...</option>
                    </select>
                    {topic === '__custom__' && (
                        <input
                            type="text"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                            placeholder="Enter concept query..."
                            className="w-full mt-3 p-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-md focus:ring-1 focus:ring-violet-500 outline-none transition-all font-mono placeholder:text-slate-600"
                        />
                    )}
                </div>

                {/* Current Mastery Display (when adaptive mode is on) */}
                {adaptiveMode && (
                    <div className="mb-6">
                        <MasteryIndicator
                            mastery={currentMastery}
                            targetDifficulty={targetDifficulty}
                            topic={topic}
                            showAdaptingMessage={true}
                        />
                    </div>
                )}

                {/* Error/Notice Banners */}
                {formError && (
                    <div className="mb-4 p-3 bg-rose-950/30 border border-rose-500/50 rounded-md flex items-center gap-3">
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <p className="text-xs font-mono text-rose-400">{formError}</p>
                    </div>
                )}
                {resetNotice && (
                    <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-500/50 rounded-md flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <p className="text-xs font-mono text-emerald-400">Profile cache cleared successfully.</p>
                    </div>
                )}

                {/* Action Buttons */}
                <button
                    onClick={handleStartQuiz}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white py-3 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-4 shadow-sm"
                >
                    {adaptiveMode ? 'Compile Adaptive Routine' : 'Compile Generic Routine'}
                </button>

                {/* Demo Reset Button */}
                <button
                    onClick={handleResetProfile}
                    className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 py-2 text-xs font-mono transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    [Reset User Cache]
                </button>
            </div>
        );
    }

    const currentQ = quiz.questions?.[currentQuestionIndex];

    if (!currentQ) {
        return (
            <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md text-center">
                <h3 className="text-lg font-semibold text-red-600 mb-2">Quiz Error</h3>
                <p className="text-gray-600 mb-4">Could not load quiz question. The quiz data may be invalid.</p>
                <button onClick={handleRetry} className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
                    Try Again
                </button>
            </div>
        );
    }

    const isCorrect = selectedOption === currentQ.correct_option_id;

    return (
        <div className="max-w-2xl mx-auto">
            {/* Adaptation Banner (for adaptive quizzes) */}
            {isAdaptiveQuiz(quiz) && (
                <div className="mb-4">
                    <MasteryIndicator
                        mastery={currentMastery}
                        targetDifficulty={targetDifficulty}
                        topic={activeTopic}
                        showAdaptingMessage={true}
                        compact={false}
                    />
                </div>
            )}

            {/* Progress */}
            <div className="mb-6 flex justify-between items-center text-sm text-gray-500">
                <span>Question {currentQuestionIndex + 1} of {quiz.questions?.length}</span>
                <div className="flex items-center gap-4">
                    <span>Score: {score}</span>
                    {isAdaptiveQuiz(quiz) && (
                        <MasteryIndicator
                            mastery={currentMastery}
                            targetDifficulty={targetDifficulty}
                            compact={true}
                        />
                    )}
                </div>
            </div>

            {/* Question Card (Premium Code Editor Aesthetic) */}
            <div className="bg-slate-950 rounded-md shadow-2xl overflow-hidden border border-slate-800 font-sans">
                <div className="p-6 md:p-8">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-violet-500 font-mono text-sm">{`>`}</span>
                            <h3 className="text-lg font-semibold text-slate-100">{currentQ.text}</h3>
                        </div>
                        <DifficultyBadge difficulty={currentQ.difficulty} />
                    </div>

                    <div className="space-y-2 font-mono text-sm">
                        {currentQ.options.map((opt, idx) => {
                            let btnClass = "w-full text-left p-3 rounded-md border transition-all flex items-center gap-3 ";
                            const letter = String.fromCharCode(65 + idx); // A, B, C, D...
                            
                            if (isSubmitted) {
                                if (opt.id === currentQ.correct_option_id) {
                                    btnClass += "border-emerald-500/50 bg-emerald-950/30 text-emerald-400";
                                } else if (opt.id === selectedOption) {
                                    btnClass += "border-rose-500/50 bg-rose-950/30 text-rose-400";
                                } else {
                                    btnClass += "border-transparent bg-slate-900/50 text-slate-600 opacity-50";
                                }
                            } else {
                                btnClass += selectedOption === opt.id
                                    ? "border-violet-500/50 bg-slate-800 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                                    : "border-transparent bg-slate-900 hover:bg-slate-800 text-slate-300 hover:border-slate-700";
                            }

                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleOptionSelect(opt.id)}
                                    disabled={isSubmitted}
                                    className={btnClass}
                                >
                                    <span className={`flex items-center justify-center w-6 h-6 rounded bg-slate-950 border ${
                                        selectedOption === opt.id && !isSubmitted ? 'border-violet-500/50 text-violet-400' : 'border-slate-800 text-slate-500'
                                    } text-xs`}>
                                        {letter}
                                    </span>
                                    <span className="flex-1">{opt.text}</span>
                                    {isSubmitted && opt.id === currentQ.correct_option_id && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                    {isSubmitted && opt.id === selectedOption && opt.id !== currentQ.correct_option_id && <XCircle className="w-4 h-4 text-rose-500" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Feedback / Remediation Section */}
                {isSubmitted && (
                    <div className={`p-6 border-t border-slate-800 ${isCorrect ? "bg-emerald-950/10" : "bg-rose-950/10"}`}>
                        <div className="flex gap-3">
                            <div className={`mt-1 ${isCorrect ? "text-emerald-500" : "text-rose-500"}`}>
                                {isCorrect ? <CheckCircle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-medium font-mono text-sm mb-2 ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                                    {isCorrect ? "// Execution Successful" : "// Concept Exception Thrown"}
                                </h4>
                                <p className="text-slate-300 text-sm leading-relaxed font-mono">
                                    <span className="text-slate-500 mr-2">{`>`}</span>
                                    {currentQ.explanation}
                                </p>

                                {/* Mastery Update Feedback */}
                                {isAdaptiveQuiz(quiz) && (
                                    <div className="mt-4 p-3 bg-slate-900 rounded-md border border-slate-800 font-mono text-sm">
                                        <span className="text-slate-500">Mastery Level: </span>
                                        <span className={isCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                                            {Math.round(currentMastery * 100)}%
                                        </span>
                                    </div>
                                )}

                                {!isCorrect && (
                                    <div className="mt-4 p-4 bg-slate-900 rounded-md border border-rose-900/50">
                                        <p className="text-xs uppercase font-mono text-slate-500 mb-2">Recommended Debugging</p>
                                        <button
                                            onClick={() => router.push(`/chat?question=${encodeURIComponent(`Explain ${currentQ.related_concept || activeTopic}`)}`)}
                                            className="text-sm text-violet-400 hover:text-violet-300 underline text-left font-mono"
                                        >
                                            $ analyze_concept --topic="{currentQ.related_concept || activeTopic}"
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleNextQuestion}
                                className="px-5 py-2.5 bg-slate-800 text-slate-200 rounded-md font-medium text-sm hover:bg-slate-700 transition-colors shadow-sm border border-slate-700"
                            >
                                {currentQuestionIndex < quiz.questions?.length - 1 ? "Next Process ->" : "Terminate Session"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Button (Submit) */}
                {!isSubmitted && (
                    <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={!selectedOption}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-sm"
                        >
                            Execute ->
                        </button>
                    </div>
                )}
            </div>

            {/* Results Modal */}
            {showResults && quiz && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleRetry}>
                    <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl transform animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto relative" onClick={(e) => e.stopPropagation()}>
                        {/* Close button */}
                        <button
                            onClick={handleRetry}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Close results"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        {/* Score Circle */}
                        <div className="relative w-36 h-36 mx-auto mb-6">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="72"
                                    cy="72"
                                    r="64"
                                    strokeWidth="10"
                                    className="stroke-gray-200 fill-none"
                                />
                                <circle
                                    cx="72"
                                    cy="72"
                                    r="64"
                                    strokeWidth="10"
                                    className={`fill-none transition-all duration-1000 ease-out ${
                                        score / quiz.questions?.length >= 0.7
                                            ? 'stroke-green-500'
                                            : score / quiz.questions?.length >= 0.4
                                            ? 'stroke-yellow-500'
                                            : 'stroke-red-500'
                                    }`}
                                    style={{
                                        strokeDasharray: 402,
                                        strokeDashoffset: 402 - (402 * score / quiz.questions?.length),
                                        strokeLinecap: 'round',
                                    }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Trophy className={`w-8 h-8 mb-1 ${
                                    score / quiz.questions?.length >= 0.7
                                        ? 'text-green-500'
                                        : score / quiz.questions?.length >= 0.4
                                        ? 'text-yellow-500'
                                        : 'text-red-500'
                                }`} />
                                <span className="text-3xl font-bold text-gray-900">
                                    {Math.round((score / quiz.questions?.length) * 100)}%
                                </span>
                            </div>
                        </div>

                        {/* Score Summary */}
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {score / quiz.questions?.length >= 0.7
                                    ? 'Great Job!'
                                    : score / quiz.questions?.length >= 0.4
                                    ? 'Good Effort!'
                                    : 'Keep Learning!'}
                            </h3>
                            <p className="text-gray-600">
                                You answered <span className="font-semibold text-blue-600">{score}</span> out of{' '}
                                <span className="font-semibold">{quiz.questions?.length}</span> questions correctly
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                Topic: {activeTopic}
                            </p>

                            {/* Adaptive Quiz Results */}
                            {isAdaptiveQuiz(quiz) && (
                                <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Zap className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">Adaptive Learning</span>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p>Current Mastery: <span className="font-semibold">{Math.round(currentMastery * 100)}%</span></p>
                                        <p>Next Quiz Difficulty: <span className={`font-semibold ${
                                            targetDifficulty === 'easy' ? 'text-green-600' :
                                            targetDifficulty === 'medium' ? 'text-yellow-600' : 'text-red-600'
                                        }`}>{targetDifficulty.charAt(0).toUpperCase() + targetDifficulty.slice(1)}</span></p>
                                    </div>
                                </div>
                            )}

                            {quiz.average_difficulty !== undefined && !isAdaptiveQuiz(quiz) && (
                                <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                                    <span className="text-gray-500">Quiz Difficulty:</span>
                                    <span className={`font-medium ${
                                        quiz.average_difficulty < 0.4 ? 'text-green-600' :
                                        quiz.average_difficulty < 0.65 ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                        {quiz.average_difficulty < 0.4 ? 'Easy' :
                                         quiz.average_difficulty < 0.65 ? 'Medium' : 'Hard'}
                                    </span>
                                    <span className="text-gray-400">
                                        ({Math.round(quiz.average_difficulty * 100)}%)
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={handleViewLearningPath}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                <MapPin className="w-5 h-5" />
                                View Learning Path
                            </button>
                            <button
                                onClick={handleRetry}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                <RotateCcw className="w-5 h-5" />
                                {isAdaptiveQuiz(quiz) ? 'Continue Learning (Next Level)' : 'Try Another Assessment'}
                            </button>
                        </div>

                        {/* Post-Quiz Recommendations */}
                        <PostQuizRecommendations
                            recommendations={recommendations}
                            isLoading={recsLoading}
                            error={recsError}
                            onPractice={handlePracticeConcept}
                            onAskTutor={handleAskTutor}
                        />

                        {/* Learning Path */}
                        <div className="mt-6 border-t border-gray-200 pt-6">
                            <LearningPath
                                conceptName={activeTopic}
                                onConceptClick={(name) => handleAskTutor(name)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
