'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { GraphStats } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { StatsSkeleton } from '@/components/Skeleton';
import {
  Network,
  MessageSquare,
  TrendingUp,
  Zap,
  GraduationCap,
  Trophy,
  Target,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import SubjectPicker from '@/components/SubjectPicker';

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topConcepts, setTopConcepts] = useState<string[]>([]);

  const { masteryMap, getMastery, currentSubject, loadSubjectTheme } = useAppStore();

  // Load subject theme on mount
  useEffect(() => {
    if (currentSubject) {
      loadSubjectTheme(currentSubject);
    }
  }, [currentSubject, loadSubjectTheme]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.getGraphStats(currentSubject);
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Unable to load statistics. Please ensure the backend is running.');
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTopConcepts = async () => {
      try {
        const response = await fetch(`/api/v1/concepts/top?limit=6&subject=${currentSubject}`);
        if (response.ok) {
          const data = await response.json();
          setTopConcepts(data.concepts || []);
        }
      } catch (err) {
        console.error('Error fetching top concepts:', err);
        setTopConcepts([]);
      }
    };

    fetchStats();
    fetchTopConcepts();
  }, [currentSubject]);

  // Calculate overall progress from mastery map
  const masteredCount = Object.values(masteryMap).filter(m => m.masteryLevel >= 0.7).length;
  const inProgressCount = Object.values(masteryMap).filter(m => m.masteryLevel >= 0.3 && m.masteryLevel < 0.7).length;
  const totalTracked = Object.keys(masteryMap).length;
  const overallMastery = totalTracked > 0
    ? Object.values(masteryMap).reduce((sum, m) => sum + m.masteryLevel, 0) / totalTracked
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Flattened Header */}
      <header className="bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                OS Mastery
              </h1>
              <p className="text-sm text-slate-500">
                Internal Operating Systems Competency Dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              <SubjectPicker />
              <Link
                href="/graph"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 transition-opacity shadow-sm"
              >
                Explore Graph
              </Link>
              <Link
                href="/chat"
                className="inline-flex items-center px-4 py-2 border border-slate-200/60 text-sm font-medium rounded-md text-slate-900 bg-white hover:bg-slate-50 transition-colors shadow-sm"
              >
                Ask Questions
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-slate-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            Master Your
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600"> Competency</span> Goals
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-xl text-slate-500">
            Engineered study paths powered by Knowledge Graphs, RAG, and AI diagnostics.
          </p>
        </div>

        {/* Statistics Dashboard */}
        <div className="mb-16">
          <h3 className="text-xl font-semibold text-slate-900 mb-6 text-center">
            System Metrics
          </h3>
          {isLoading ? (
            <StatsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <StatCard
                title="Graph Nodes"
                value={stats?.concept_count ?? 0}
                icon={<Network className="w-6 h-6" />}
                color="violet"
                description="Core concepts actively tracked"
              />
              <StatCard
                title="Learning Modules"
                value={stats?.module_count ?? 0}
                icon={<TrendingUp className="w-6 h-6" />}
                color="fuchsia"
                description="Engineered training paths"
              />
              <StatCard
                title="Connections"
                value={stats?.relationship_count ?? 0}
                icon={<Zap className="w-6 h-6" />}
                color="slate"
                description="Causal links & dependencies"
              />
            </div>
          )}
          {error && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200/60 rounded-md">
              <p className="text-sm text-rose-600 text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Learning Progress Section */}
        <div className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Trophy className="w-6 h-6 text-slate-700" />
            <h3 className="text-xl font-semibold text-slate-900">
              Global Readiness
            </h3>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-slate-200/60 p-6">
            {totalTracked > 0 ? (
              <div className="space-y-6">
                {/* Overall Progress */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Overall Mastery</p>
                    <p className="text-3xl font-mono text-slate-900">
                      {Math.round(overallMastery * 100)}%
                    </p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-2xl font-mono text-violet-600">{masteredCount}</p>
                      <p className="text-xs text-slate-500">Mastered</p>
                    </div>
                    <div>
                      <p className="text-2xl font-mono text-fuchsia-600">{inProgressCount}</p>
                      <p className="text-xs text-slate-500">In Progress</p>
                    </div>
                    <div>
                      <p className="text-2xl font-mono text-slate-400">{totalTracked}</p>
                      <p className="text-xs text-slate-500">Total Tracked</p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1 bg-slate-200 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-500"
                    style={{ width: `${overallMastery * 100}%` }}
                  />
                </div>

                {/* Concept Progress List */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(masteryMap).slice(0, 6).map(([name, data]) => (
                    <div
                      key={name}
                      className="p-3 bg-white rounded-md border border-slate-200/60 hover:border-violet-300 cursor-pointer shadow-sm transition-all"
                      onClick={() => router.push(`/chat?question=${encodeURIComponent(`Explain ${name}`)}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{name}</span>
                        <span className={`text-xs font-mono ${
                          data.masteryLevel >= 0.7 ? 'text-violet-600' :
                          data.masteryLevel >= 0.4 ? 'text-fuchsia-600' : 'text-slate-400'
                        }`}>
                          {Math.round(data.masteryLevel * 100)}%
                        </span>
                      </div>
                      <div className="h-1 bg-slate-200 rounded-sm overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            data.masteryLevel >= 0.7 ? 'bg-violet-600' :
                            data.masteryLevel >= 0.4 ? 'bg-fuchsia-500' : 'bg-slate-300'
                          }`}
                          style={{ width: `${data.masteryLevel * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-violet-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-900 mb-2">
                  System Initialization Ready
                </h4>
                <p className="text-slate-500 mb-6 max-w-md mx-auto text-sm">
                  Execute assessments and initiate diagnostic routines to calibrate your competency graph.
                </p>
                <div className="flex justify-center gap-4">
                  <Link
                    href="/assessment"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    <BookOpen className="w-4 h-4" />
                    Run Assessment
                  </Link>
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Access Diagnostics
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Start Concepts */}
        {topConcepts.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Target className="w-5 h-5 text-violet-600" />
              <h3 className="text-xl font-semibold text-slate-900">
                Core Competencies
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {topConcepts.map((concept) => (
                <button
                  key={concept}
                  onClick={() => router.push(`/chat?question=${encodeURIComponent(`Explain ${concept}`)}`)}
                  className="group p-4 bg-white rounded-md border border-slate-200/60 hover:border-violet-400 hover:shadow-sm transition-all text-left shadow-sm"
                >
                  <p className="font-medium text-slate-900 group-hover:text-violet-600 transition-colors text-sm">
                    {concept}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-slate-500 group-hover:text-violet-500">
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feature Cards */}
        <div className="mb-16">
          <h3 className="text-xl font-semibold text-slate-900 mb-6 text-center">
            System Capabilities
          </h3>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              title="Knowledge Graph"
              description="Visualize dependency trees and prerequisite nodes"
              icon={<Network className="w-5 h-5" />}
              link="/graph"
            />
            <FeatureCard
              title="Diagnostic Chat"
              description="Interact with the LLM using graph-aware context"
              icon={<MessageSquare className="w-5 h-5" />}
              link="/chat"
            />
            <FeatureCard
              title="RAG Indexing"
              description="Vector-based query expansion using Neo4j and OpenSearch"
              icon={<TrendingUp className="w-5 h-5" />}
              link="/comparison"
            />
            <FeatureCard
              title="Local Execution"
              description="Zero-trust architecture: Models run locally"
              icon={<Zap className="w-5 h-5" />}
              link="/about"
            />
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-md shadow-sm border border-slate-200/60 p-8">
          <h3 className="text-xl font-semibold text-slate-900 mb-6 text-center">
            Pipeline Architecture
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step
              number={1}
              title="Data Ingestion"
              description="Structured ingestion of OS question banks and component mapping"
            />
            <Step
              number={2}
              title="Graph Construction"
              description="Edges (PREREQ, COVERS, RELATED) compiled into local Neo4j instance"
            />
            <Step
              number={3}
              title="Vector Retrieval"
              description="Semantic retrieval executed against embedded document chunks"
            />
          </div>
        </div>


      </main>
    </div>
  );
}

// Sub-components

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'violet' | 'fuchsia' | 'slate';
  description: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  const colorClasses = {
    violet: 'text-violet-600 bg-violet-50/50',
    fuchsia: 'text-fuchsia-600 bg-fuchsia-50/50',
    slate: 'text-slate-600 bg-slate-50',
  };

  return (
    <div className="bg-white rounded-md shadow-sm p-6 border border-slate-200/60 hover:shadow transition-shadow">
      <div className={`inline-flex p-2.5 rounded-md ${colorClasses[color]}`}>
        {icon}
      </div>
      <h4 className="mt-4 text-3xl font-mono font-semibold text-slate-900 tracking-tight">
        {value.toLocaleString()}
      </h4>
      <p className="text-sm font-medium text-slate-900 mt-1">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
}

function FeatureCard({ title, description, icon, link }: FeatureCardProps) {
  return (
    <Link href={link}>
      <div className="bg-white rounded-md shadow-sm p-6 border border-slate-200/60 hover:shadow hover:border-violet-300 transition-all cursor-pointer h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-slate-700">{icon}</div>
          <h4 className="text-sm font-medium text-slate-900">{title}</h4>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-slate-900 text-white font-mono font-semibold text-sm mb-4 shadow-sm">
        {number}
      </div>
      <h4 className="text-sm font-medium text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
}
