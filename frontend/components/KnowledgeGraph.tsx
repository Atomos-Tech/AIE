'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape, {
  Core,
  NodeSingular,
  EdgeSingular,
} from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import type { GraphData } from '@/lib/types';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/lib/store';

// Type for cose-bilkent layout options (not included in @types/cytoscape)
type CoseBilkentLayoutOptions = {
  name: 'cose-bilkent';
  randomize?: boolean;
  nodeRepulsion?: number;
  idealEdgeLength?: number;
  edgeElasticity?: number;
  nestingFactor?: number;
  gravity?: number;
  numIter?: number;
  tile?: boolean;
  animate?: boolean | 'end' | 'during';
  animationDuration?: number;
};

// Register layout
if (typeof cytoscape !== 'undefined') {
  cytoscape.use(coseBilkent);
}

// Fallback color when no subject theme is loaded yet
const DEFAULT_CHAPTER_COLORS: Record<string, string> = {
  'default': '#6366f1',
};

interface KnowledgeGraphProps {
  data: GraphData;
  onNodeClick?: (nodeId: string, nodeName: string) => void;
  highlightedConcepts?: string[];
  className?: string;
  chapterColors?: Record<string, string>; // Dynamic colors from subject theme
}

// Helper to get node state based on mastery level
function getNodeStateClass(masteryLevel: number): string {
  if (masteryLevel >= 0.7) return 'passed';
  if (masteryLevel >= 0.3) return 'active';
  return 'locked';
}
export default function KnowledgeGraph({
  data,
  onNodeClick,
  highlightedConcepts = [],
  className = '',
  chapterColors,
}: KnowledgeGraphProps) {
  // Merge provided colors with defaults (memoized to prevent unnecessary re-renders)
  const effectiveColors = useMemo(
    () => ({ ...DEFAULT_CHAPTER_COLORS, ...chapterColors }),
    [chapterColors]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  
  const { masteryMap } = useAppStore();

  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: {
        nodes: data.nodes,
        edges: data.edges,
      },
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': '#ffffff',
            'width': (ele: NodeSingular) => {
              const importance = ele.data('importance') || 0.5;
              return 35 + importance * 30; // Slightly uniform sizing
            },
            'height': (ele: NodeSingular) => {
              const importance = ele.data('importance') || 0.5;
              return 35 + importance * 30;
            },
            'font-family': 'var(--font-inter), sans-serif',
            'font-size': 11,
            'font-weight': '600',
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'color': '#0f172a',
            'border-width': 1,
            'border-color': '#cbd5e1',
            'transition-property': 'background-color, border-color, border-width, color',
            'transition-duration': 300,
            'shape': 'round-rectangle',
          },
        },
        {
          selector: 'node.passed',
          style: {
            'background-color': '#ffffff',
            'border-width': 2,
            'border-color': '#8b5cf6', // violet-500
            'color': '#6d28d9', // violet-700
          },
        },
        {
          selector: 'node.active',
          style: {
            'background-color': '#ffffff',
            'border-width': 3,
            'border-color': '#d946ef', // fuchsia-500
            'color': '#0f172a',
            'shadow-blur': 10,
            'shadow-color': '#8b5cf6',
            'shadow-opacity': 0.3,
          },
        },
        {
          selector: 'node.locked',
          style: {
            'background-color': '#f8fafc', // slate-50
            'border-width': 1,
            'border-style': 'dashed',
            'border-color': '#94a3b8', // slate-400
            'color': '#94a3b8',
            'opacity': 0.7,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#cbd5e1', // Thin 1px slate line
            'target-arrow-shape': 'triangle' as const,
            'target-arrow-color': '#cbd5e1',
            'curve-style': 'bezier' as const,
            'label': 'data(label)',
            'font-family': 'var(--font-mono), monospace',
            'font-size': 9,
            'color': '#64748b',
            'text-rotation': 'autorotate' as const,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle' as const,
            'opacity': 0.7,
            'transition-property': 'opacity, width, line-color',
            'transition-duration': 300,
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'width': 4,
            'opacity': 1,
            'z-index': 10,
          },
        },
        {
          selector: 'edge.faded',
          style: {
            'opacity': 0.15,
          },
        },
      ],
      layout: {
        name: 'cose-bilkent',
        randomize: false,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        animate: 'end',
        animationDuration: 1000,
      } as CoseBilkentLayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    });

    cyRef.current = cy;

    // Apply states based on mastery Map
    cy.nodes().forEach(node => {
      const label = node.data('label') || '';
      const mastery = masteryMap[label]?.masteryLevel || 0;
      node.addClass(getNodeStateClass(mastery));
    });

    // Node click handler with enhanced visual feedback
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();
      const nodeName = node.data('label');

      // Remove all previous classes
      cy.nodes().removeClass('selected highlighted faded');
      cy.edges().removeClass('highlighted faded');

      // Add selection to clicked node
      node.addClass('selected');

      // Get neighborhood (connected nodes and edges)
      const neighborhood = node.neighborhood();
      const connectedNodes = neighborhood.nodes();
      const connectedEdges = neighborhood.edges();

      // Highlight connected elements
      connectedNodes.addClass('highlighted');
      connectedEdges.addClass('highlighted');

      // Fade non-connected elements for focus
      cy.nodes().not(node).not(connectedNodes).addClass('faded');
      cy.edges().not(connectedEdges).addClass('faded');

      setSelectedNode(nodeId);

      // Call parent callback if provided
      if (onNodeClick) {
        onNodeClick(nodeId, nodeName);
      }
    });

    // Click on background to reset view
    cy.on('tap', (event) => {
      if (event.target === cy) {
        cy.nodes().removeClass('selected highlighted faded');
        cy.edges().removeClass('highlighted faded');
        setSelectedNode(null);
      }
    });

    // Hover effects for better interactivity
    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      if (!node.hasClass('selected')) {
        node.style('cursor', 'pointer');
      }
    });

    // Cleanup
    return () => {
      cy.destroy();
    };
  }, [data, onNodeClick, masteryMap]);

  // Update highlighted concepts when prop changes (from chat page)
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;

    // Remove all highlights and fades
    cy.nodes().removeClass('highlighted faded');
    cy.edges().removeClass('highlighted faded');

    // Add highlights for specified concepts
    if (highlightedConcepts.length > 0) {
      const highlightedNodes = cy.collection();

      highlightedConcepts.forEach((conceptName) => {
        const node = cy.nodes().filter((n) => {
          const label = n.data('label') || '';
          return label.toLowerCase() === conceptName.toLowerCase() ||
                 label.toLowerCase().includes(conceptName.toLowerCase());
        });
        if (node.length > 0) {
          highlightedNodes.merge(node);
        }
      });

      // Highlight matched nodes
      highlightedNodes.addClass('highlighted');

      // Get all connected edges between highlighted nodes
      const connectedEdges = highlightedNodes.edgesWith(highlightedNodes);
      connectedEdges.addClass('highlighted');

      // Fade non-highlighted nodes for focus
      cy.nodes().not(highlightedNodes).addClass('faded');
      cy.edges().not(connectedEdges).addClass('faded');

      // Fit view to highlighted nodes
      if (highlightedNodes.length > 0) {
        cy.fit(highlightedNodes, 80);
      }
    }
  }, [highlightedConcepts]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
    cyRef.current?.center();
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
    cyRef.current?.center();
  }, []);

  const handleFitToView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 50);
  }, []);

  const handleResetView = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.nodes().removeClass('selected highlighted faded');
    cyRef.current.edges().removeClass('highlighted faded');
    setSelectedNode(null);
    cyRef.current.fit(undefined, 50);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="cytoscape-container w-full h-full bg-slate-50 rounded-md border border-slate-200/60 shadow-sm"
        style={{ minHeight: '600px' }}
      />

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-md shadow-sm p-4 border border-slate-200/60">
        <h4 className="font-semibold text-sm text-slate-900 mb-2 font-mono tracking-tight">NODE STATES</h4>
        <div className="space-y-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-white border-2 border-violet-500 rounded-sm"></div>
            <span className="text-slate-700">Passed</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-white border-2 border-fuchsia-500 rounded-sm shadow-sm shadow-violet-500/30"></div>
            <span className="text-slate-700">Active</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-slate-50 border border-dashed border-slate-400 rounded-sm"></div>
            <span className="text-slate-700">Locked</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white rounded-md shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
          aria-label="Zoom in"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-slate-700" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white rounded-md shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
          aria-label="Zoom out"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-slate-700" />
        </button>
        <button
          onClick={handleFitToView}
          className="p-2 bg-white rounded-md shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
          aria-label="Fit to view"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4 text-slate-700" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-white rounded-md shadow-sm border border-slate-200/60 hover:bg-slate-50 transition-colors"
          aria-label="Reset view"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 bg-white rounded-md shadow-sm p-5 border border-slate-200/60 max-w-xs animate-in slide-in-from-left duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-widest font-mono">
              Selected Node
            </h4>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-2">
            {cyRef.current?.getElementById(selectedNode).data('label')}
          </p>
          <div className="flex flex-col gap-1 text-xs font-mono text-slate-500">
            <div className="flex justify-between">
              <span>Importance</span>
              <span className="text-violet-600 font-semibold">
                {(cyRef.current?.getElementById(selectedNode).data('importance') * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Connections</span>
              <span className="text-slate-900 font-semibold">
                {cyRef.current?.getElementById(selectedNode).neighborhood().nodes().length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="text-slate-900 font-semibold uppercase">
                {getNodeStateClass(masteryMap[cyRef.current?.getElementById(selectedNode).data('label')]?.masteryLevel || 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
