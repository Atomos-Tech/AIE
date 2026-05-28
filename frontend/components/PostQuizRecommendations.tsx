'use client';

import { useState } from 'react';
import { AlertCircle, TrendingUp, BookOpen, MessageSquare, ChevronDown, ChevronUp, Sparkles, Target } from 'lucide-react';

interface ReadingMaterial {
  text: string;
  section?: string;
  module_title?: string;
  relevance_score?: number;
}

interface ConceptRecommendation {
  name: string;
  importance?: number;
  mastery?: number;
  relationship_type?: string;
}

interface RemediationBlock {
  concept: string;
  prerequisites: ConceptRecommendation[];
  reading_materials: ReadingMaterial[];
}

interface AdvancementBlock {
  concept: string;
  advanced_topics: ConceptRecommendation[];
  deep_dive_content?: string;
}

interface RecommendationResponse {
  path_type: string;
  score_pct: number;
  remediation: RemediationBlock[];
  advancement: AdvancementBlock[];
  summary: string;
}

interface PostQuizRecommendationsProps {
  recommendations: RecommendationResponse | null;
  isLoading: boolean;
  error: string | null;
  onPractice: (concept: string) => void;
  onAskTutor: (concept: string) => void;
}

function MasteryBar({ mastery }: { mastery?: number }) {
  const value = mastery ?? 0.3;
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? 'bg-emerald-500' : value >= 0.4 ? 'bg-violet-500' : 'bg-rose-500';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-sm overflow-hidden">
        <div className={`h-full transition-all duration-500 ${color} shadow-[0_0_10px_currentColor]`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-10 text-right">[{pct}%]</span>
    </div>
  );
}

function ReadingCard({ material }: { material: ReadingMaterial }) {
  const [expanded, setExpanded] = useState(false);
  const preview = material.text.length > 200 ? material.text.slice(0, 200) + '...' : material.text;

  return (
    <div className="p-4 bg-slate-900 rounded-md border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-2 mb-2 text-xs font-mono">
        <BookOpen className="w-3.5 h-3.5 text-violet-400" />
        {material.module_title && (
          <span className="text-slate-300">{material.module_title}</span>
        )}
        {material.section && (
          <span className="text-slate-500">:: {material.section}</span>
        )}
      </div>
      <p className="text-sm text-slate-400 font-mono leading-relaxed pl-3 border-l border-slate-800">
        <span className="text-slate-600 mr-2">{`>`}</span>
        {expanded ? material.text : preview}
      </p>
      {material.text.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-xs text-violet-400 hover:text-violet-300 font-mono transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? '[Collapse Output]' : '[Expand Output]'}
        </button>
      )}
    </div>
  );
}

export default function PostQuizRecommendations({
  recommendations,
  isLoading,
  error,
  onPractice,
  onAskTutor,
}: PostQuizRecommendationsProps) {
  if (isLoading) {
    return (
      <div className="mt-8 p-6 bg-slate-950 rounded-md border border-slate-800 animate-pulse font-mono">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 bg-slate-800 rounded" />
          <div className="h-5 w-48 bg-slate-800 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-800/50 rounded w-3/4" />
          <div className="h-20 bg-slate-800/50 rounded" />
          <div className="h-20 bg-slate-800/50 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-4 bg-rose-950/30 rounded-md border border-rose-500/50 font-mono">
        <div className="flex items-center gap-2 text-rose-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!recommendations) return null;

  return (
    <div className="mt-8 space-y-6 font-mono">
      {/* Summary */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-md">
        <p className="text-sm text-slate-300">
          <span className="text-violet-500 mr-2">$</span>
          ./analyze_performance --summary
        </p>
        <p className="text-sm text-slate-400 mt-2 pl-4 border-l border-slate-700">
          {recommendations.summary}
        </p>
      </div>

      {/* Remediation Section */}
      {recommendations.remediation.length > 0 && (
        <div className="bg-slate-950 rounded-md border border-rose-900/50 overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-rose-900/50 bg-rose-950/20">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-semibold tracking-wide">Exception Stack Trace</h4>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {recommendations.remediation.map((block) => (
              <div key={block.concept} className="relative">
                <h5 className="font-semibold text-rose-300 mb-4 flex items-center gap-2">
                  <span className="text-rose-500/50">#</span>
                  {block.concept}
                </h5>

                {/* Prerequisites */}
                {block.prerequisites.length > 0 && (
                  <div className="mb-6 ml-4 pl-4 border-l border-slate-800">
                    <p className="text-xs uppercase font-semibold text-slate-500 mb-3 tracking-widest">
                      Missing Dependencies
                    </p>
                    <div className="space-y-3">
                      {block.prerequisites.map((prereq) => (
                        <div
                          key={prereq.name}
                          className="p-4 bg-slate-900 rounded-md border border-slate-800"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <span className="text-sm font-medium text-slate-200">{prereq.name}</span>
                            <span className="text-xs text-rose-500/80 shrink-0">
                              [{prereq.relationship_type === 'PREREQ' ? 'REQ' : 'DEP'}]
                            </span>
                          </div>
                          <MasteryBar mastery={prereq.mastery} />
                          <div className="flex gap-3 mt-4">
                            <button
                              onClick={() => onPractice(prereq.name)}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors shadow-sm"
                            >
                              <Target className="w-3.5 h-3.5 text-violet-400" />
                              $ execute_drill
                            </button>
                            <button
                              onClick={() => onAskTutor(prereq.name)}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors shadow-sm"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                              $ debug_concept
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reading Materials */}
                {block.reading_materials.length > 0 && (
                  <div className="ml-4 pl-4 border-l border-slate-800">
                    <p className="text-xs uppercase font-semibold text-slate-500 mb-3 tracking-widest">
                      Documentation Found
                    </p>
                    <div className="space-y-3">
                      {block.reading_materials.map((material, idx) => (
                        <ReadingCard key={idx} material={material} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback: no prereqs and no reading */}
                {block.prerequisites.length === 0 && block.reading_materials.length === 0 && (
                  <p className="text-sm text-slate-500 italic ml-4 pl-4 border-l border-slate-800">
                    // No direct prerequisite path found. Awaiting manual debugging.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advancement Section */}
      {recommendations.advancement.length > 0 && (
        <div className="bg-slate-950 rounded-md border border-emerald-900/50 overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-emerald-900/50 bg-emerald-950/20">
            <div className="flex items-center gap-3 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
              <h4 className="font-semibold tracking-wide">Execution Success</h4>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {recommendations.advancement.map((block) => (
              <div key={block.concept} className="relative">
                <h5 className="font-semibold text-emerald-300 mb-4 flex items-center gap-2">
                  <span className="text-emerald-500/50">#</span>
                  {block.concept}
                </h5>

                {/* Advanced Topics */}
                {block.advanced_topics.length > 0 && (
                  <div className="mb-6 ml-4 pl-4 border-l border-slate-800">
                    <p className="text-xs uppercase font-semibold text-slate-500 mb-3 tracking-widest">
                      Available Next Nodes
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {block.advanced_topics.map((adv) => (
                        <button
                          key={adv.name}
                          onClick={() => onPractice(adv.name)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-slate-900 rounded border border-emerald-900 hover:bg-emerald-950 hover:border-emerald-700 transition-colors shadow-sm shadow-emerald-900/20"
                        >
                          <span className="text-emerald-500">{`>`}</span> {adv.name}
                          {adv.mastery !== undefined && adv.mastery !== null && (
                            <span className="text-xs text-emerald-600 ml-1">
                              [{Math.round(adv.mastery * 100)}%]
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {block.advanced_topics.length === 0 && (
                  <p className="text-sm text-emerald-600/70 mb-4 ml-4 pl-4 border-l border-slate-800">
                    // Frontier reached. End of execution path.
                  </p>
                )}

                {/* Deep Dive Content */}
                {block.deep_dive_content && (
                  <div className="ml-4 pl-4 border-l border-slate-800">
                    <div className="p-5 bg-slate-900 rounded-md border border-violet-900/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        <span className="text-xs uppercase font-semibold text-violet-400 tracking-widest">Deep Dive Log</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line border-l-2 border-violet-500/30 pl-3">
                        {block.deep_dive_content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
