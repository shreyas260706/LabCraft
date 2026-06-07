import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Terminal,
  BookOpen,
  Clock,
  Play,
  HelpCircle,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import HowItWorksModal from '../components/HowItWorksModal';
import { useSEO } from '../hooks/useSEO';

const HISTORY_KEY = 'labcraft_history';

/* ─── Ecosystem Node Data ────────────────────────────── */
const ECOSYSTEM_NODES = [
  {
    id: 'labcraft',
    label: 'LabCraft',
    status: 'Live',
    color: '#00E5FF',
    orbitRadius: 0.32,
    speed: 0.0004,
    description: 'Instantly transforms course inputs into structured PDF/DOCX lab reports with annotated source code, theories, and viva sheets.',
  },
  {
    id: 'pyqspace',
    label: 'PYQSpace',
    status: 'Coming Soon',
    color: '#E040FB',
    orbitRadius: 0.45,
    speed: 0.00025,
    description: 'Previous year papers reimagined. Solved answers, exam analytics, and priority chapter breakdowns optimized for late-night study.',
  },
];

/* ─── Mock topics data for Act 3 ─────────────────────── */
const MOCK_TOPICS = [
  {
    id: 'bst',
    topic: 'Binary Search Tree',
    subject: 'Data Structures',
    semester: 'Semester 3',
    branch: 'CSE',
    theory: `• A Binary Search Tree is a node-based binary tree data structure.
• The left subtree of a node contains only nodes with keys lesser than the parent node's key.
• The right subtree of a node contains only nodes with keys greater than the parent node's key.
• Inorder traversal of a BST always yields keys in non-decreasing sorted order.
• Search and insertion time complexity on average is O(log n).`,
    code: `#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* left;
    Node* right;
    Node(int val) {
        data = val;
        left = right = nullptr;
    }
};

Node* insert(Node* root, int val) {
    if (!root) return new Node(val);
    if (val < root->data)
        root->left = insert(root->left, val);
    else
        root->right = insert(root->right, val);
    return root;
}`,
    viva: [
      { q: "What is the worst-case search complexity of a BST?", a: "O(n) when the tree becomes skewed (resembling a linked list)." },
      { q: "Which tree traversal gives sorted order for a BST?", a: "Inorder Traversal (Left, Root, Right)." },
      { q: "What is the primary benefit of a BST over a standard binary tree?", a: "Faster search, insertion, and deletion operations, averaging O(log n)." }
    ],
    slides: [
      { title: "Slide 1: Introduction to BST", points: ["Definition and node-based structure", "Key property: Left < Node < Right", "Null child representation"] },
      { title: "Slide 2: Insertion Algorithm", points: ["Recursive comparison starting from root", "Choosing left/right subtree", "Leaf creation step"] }
    ]
  },
  {
    id: 'dijkstra',
    topic: "Dijkstra's Algorithm",
    subject: 'Analysis & Design of Algorithms',
    semester: 'Semester 4',
    branch: 'CSE',
    theory: `• Dijkstra's algorithm finds the shortest path from a single source vertex to all other vertices in a weighted graph.
• It operates greedily by always expanding the closest unvisited node.
• It requires all edge weights to be non-negative.
• Frequently optimized using a Min-Priority Queue (Binary/Fibonacci Heap).
• Time complexity is O((V + E) log V) with binary heap implementations.`,
    code: `#include <iostream>
#include <vector>
#include <queue>
using namespace std;
#define INF 1e9

void dijkstra(int src, vector<vector<pair<int, int>>>& adj, int n) {
    vector<int> dist(n, INF);
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
    dist[src] = 0;
    pq.push({0, src});
    while(!pq.empty()) {
        int u = pq.top().second;
        pq.pop();
        for(auto edge : adj[u]) {
            int v = edge.first, w = edge.second;
            if(dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
}`,
    viva: [
      { q: "Why does Dijkstra fail on negative weight edges?", a: "Dijkstra assumes a node's distance is finalized once visited. Negative edges can provide a shorter path later." },
      { q: "What is the optimal heap implementation for Dijkstra?", a: "Fibonacci Heap, reducing complexity to O(E + V log V)." },
      { q: "What is the difference between Dijkstra and Prim's algorithm?", a: "Dijkstra computes path lengths from a single source; Prim's constructs a Minimum Spanning Tree." }
    ],
    slides: [
      { title: "Slide 1: Shortest Path Overview", points: ["Single-source shortest path problem", "Weighted graphs with non-negative edges", "Real-world routing applications"] },
      { title: "Slide 2: Relaxation Concept", points: ["Key formula: dist[v] = min(dist[v], dist[u] + weight)", "Greedy step selection", "Priority Queue usage"] }
    ]
  }
];

/* ─── Capability Cards ───────────────────────────────── */
const CAPABILITIES = [
  {
    icon: '🧪',
    title: 'Lab Reports',
    desc: 'Theory, code, viva, slides — generated in seconds.',
    color: '#00E5FF',
    status: 'Live',
  },
  {
    icon: '📄',
    title: 'Exam Prep',
    desc: 'Solved PYQs, topic priorities, mark analytics.',
    color: '#E040FB',
    status: 'Coming Soon',
  },
  {
    icon: '📊',
    title: 'Presentations',
    desc: 'Auto-generated slides from any experiment topic.',
    color: '#7B61FF',
    status: 'Live',
  },
];

/* ═══════════════════════════════════════════════════════════
   Orbital Canvas Component — Living Ecosystem Visualization
   ═══════════════════════════════════════════════════════════ */
function OrbitalCanvas({ setActiveNode }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const angleRef = useRef(0);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -1, y: -1 });

  // Initialize energy particles once
  const [energyParticles] = useState(() =>
    Array.from({ length: 24 }).map(() => ({
      orbit: Math.random() < 0.5 ? 0 : 1,
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() * 0.003 + 0.001) * (Math.random() < 0.5 ? 1 : -1),
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }))
  );

  useEffect(() => {
    particlesRef.current = energyParticles;
  }, [energyParticles]);

  const draw = useCallback((ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h);

    ctx.clearRect(0, 0, w, h);

    // Ambient core glow
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.18);
    coreGlow.addColorStop(0, 'rgba(0, 229, 255, 0.08)');
    coreGlow.addColorStop(0.5, 'rgba(123, 97, 255, 0.03)');
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.fillRect(0, 0, w, h);

    // Draw orbit rings
    ECOSYSTEM_NODES.forEach((node, i) => {
      const r = node.orbitRadius * scale;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === 0
        ? 'rgba(0, 229, 255, 0.08)'
        : 'rgba(224, 64, 251, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw energy particles
    particlesRef.current.forEach((p) => {
      const node = ECOSYSTEM_NODES[p.orbit];
      const r = node.orbitRadius * scale;
      const px = cx + Math.cos(p.angle) * r;
      const py = cy + Math.sin(p.angle) * r * 0.55;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.orbit === 0
        ? `rgba(0, 229, 255, ${p.opacity})`
        : `rgba(224, 64, 251, ${p.opacity * 0.7})`;
      ctx.fill();
      p.angle += p.speed;
    });

    // Draw connection beams from core to product nodes
    ECOSYSTEM_NODES.forEach((node, i) => {
      const r = node.orbitRadius * scale;
      const baseAngle = angleRef.current * (node.speed / 0.0004);
      const nodeAngle = baseAngle + (i === 0 ? 0 : Math.PI * 0.7);
      const nx = cx + Math.cos(nodeAngle) * r;
      const ny = cy + Math.sin(nodeAngle) * r * 0.55;

      // Connection line
      const grad = ctx.createLinearGradient(cx, cy, nx, ny);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
      grad.addColorStop(1, i === 0 ? 'rgba(0, 229, 255, 0.04)' : 'rgba(224, 64, 251, 0.04)');
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Energy pulse dot traveling along the beam
      const pulseT = (Math.sin(angleRef.current * 0.003 + i * 2) + 1) / 2;
      const pulseX = cx + (nx - cx) * pulseT;
      const pulseY = cy + (ny - cy) * pulseT;
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? 'rgba(0, 229, 255, 0.6)' : 'rgba(224, 64, 251, 0.5)';
      ctx.fill();

      // Product node (outer glow + circle + label)
      const isHovered = mouseRef.current.x >= 0 &&
        Math.hypot(mouseRef.current.x - nx, mouseRef.current.y - ny) < 30;

      // Outer glow
      const nodeGlow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 28);
      const glowColor = i === 0 ? '0, 229, 255' : '224, 64, 251';
      nodeGlow.addColorStop(0, `rgba(${glowColor}, ${isHovered ? 0.3 : 0.12})`);
      nodeGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = nodeGlow;
      ctx.fillRect(nx - 30, ny - 30, 60, 60);

      // Node circle
      ctx.beginPath();
      ctx.arc(nx, ny, isHovered ? 14 : 12, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${i === 0 ? '5, 5, 8' : '5, 5, 8'}, 0.8)`;
      ctx.fill();
      ctx.strokeStyle = node.color;
      ctx.lineWidth = isHovered ? 2 : 1.5;
      ctx.stroke();

      // Node inner dot
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Label
      ctx.font = '600 11px "Space Grotesk", system-ui, sans-serif';
      ctx.fillStyle = isHovered ? '#F1F5F9' : '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, nx, ny + 26);

      // Status badge
      ctx.font = '500 8px "Inter", system-ui, sans-serif';
      ctx.fillStyle = node.status === 'Live' ? '#34D399' : '#E040FB';
      ctx.fillText(node.status, nx, ny + 38);
    });

    // Core node
    const coreR = scale * 0.035;
    const corePulse = 1 + Math.sin(angleRef.current * 0.002) * 0.15;

    // Core outer glow
    const coreOuterGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 4);
    coreOuterGlow.addColorStop(0, 'rgba(0, 229, 255, 0.12)');
    coreOuterGlow.addColorStop(0.5, 'rgba(123, 97, 255, 0.04)');
    coreOuterGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreOuterGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 4, 0, Math.PI * 2);
    ctx.fill();

    // Core circle
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * corePulse, 0, Math.PI * 2);
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, '#00E5FF');
    coreGrad.addColorStop(0.6, '#7B61FF');
    coreGrad.addColorStop(1, '#5B3FE0');
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Core label
    ctx.font = '700 13px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#F1F5F9';
    ctx.textAlign = 'center';
    ctx.fillText('IPUSpace', cx, cy + coreR * corePulse + 22);

    ctx.font = '500 9px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText('Core Platform', cx, cy + coreR * corePulse + 35);

    angleRef.current += 1;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let running = true;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h);

      ECOSYSTEM_NODES.forEach((node, i) => {
        const r = node.orbitRadius * scale;
        const baseAngle = angleRef.current * (node.speed / 0.0004);
        const nodeAngle = baseAngle + (i === 0 ? 0 : Math.PI * 0.7);
        const nx = cx + Math.cos(nodeAngle) * r;
        const ny = cy + Math.sin(nodeAngle) * r * 0.55;
        if (Math.hypot(mx - nx, my - ny) < 30) {
          setActiveNode(node.id);
        }
      });

      // Check core click
      if (Math.hypot(mx - cx, my - cy) < scale * 0.05) {
        setActiveNode('ipuspace');
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    const loop = () => {
      if (!running) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      draw(ctx, rect.width, rect.height);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [draw, setActiveNode]);

  return (
    <canvas
      ref={canvasRef}
      className="ecosystem-canvas"
      style={{ width: '100%', height: '100%', cursor: 'pointer' }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   Landing Page — IPUSpace Platform Identity
   ═══════════════════════════════════════════════════════════ */
function LandingPage() {
  useSEO({
    title: 'IPUSpace — The Academic Operating System',
    description: 'The digital campus that transforms how IPU students study, submit, and succeed.',
    url: '/',
  });

  const navigate = useNavigate();
  const [isHiwOpen, setIsHiwOpen] = useState(false);

  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.debug(err);
      return [];
    }
  });

  const [activeNode, setActiveNode] = useState('ipuspace');
  const [selectedTopicId, setSelectedTopicId] = useState('bst');
  const [activeLabTab, setActiveLabTab] = useState('theory');
  const [isScanning, setIsScanning] = useState(false);

  const [particles] = useState(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * -25,
      drift: Math.random() * 3 - 1.5,
    }))
  );

  const [now] = useState(() => Date.now());

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify([])); } catch (err) { console.debug(err); }
  };

  const handleLoadHistory = (entry) => navigate(`/result/${entry.id}`);

  const timeAgo = (isoStr) => {
    const diff = now - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleSelectTopic = (id) => {
    if (id === selectedTopicId || isScanning) return;
    setIsScanning(true);
    setTimeout(() => { setSelectedTopicId(id); setIsScanning(false); }, 900);
  };

  const currentTopicData = MOCK_TOPICS.find(t => t.id === selectedTopicId);

  return (
    <div className="home-page">
      {/* ─── Ambient Background Layer ──────────────────────────── */}
      <div className="ipu-grid-bg"></div>
      <div className="ipu-ambient-glow glow-cyan-top"></div>
      <div className="ipu-ambient-glow glow-violet-middle"></div>
      <div className="ipu-ambient-glow glow-aurora-bottom"></div>

      {/* Energy Particles */}
      <div className="ipu-particles">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="ipu-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{
              y: ['0vh', '-50vh'],
              x: ['0vw', `${p.drift}vw`],
              opacity: [0, 0.4, 0.2, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* ═══ ACT 1: IDENTITY (Hero) ════════════════════════════════ */}
      <motion.section
        className="landing-section hero-identity"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Constellation Logo Mark */}
        <div className="hero-logo-mark">
          <svg width="80" height="80" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="heroG" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00E5FF"/>
                <stop offset="50%" stopColor="#7B61FF"/>
                <stop offset="100%" stopColor="#E040FB"/>
              </linearGradient>
              <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,229,255,0.15)"/>
                <stop offset="100%" stopColor="transparent"/>
              </radialGradient>
            </defs>
            {/* Background glow */}
            <circle cx="32" cy="32" r="30" fill="url(#heroGlow)"/>
            {/* Outer orbit */}
            <ellipse cx="32" cy="32" rx="28" ry="28" stroke="url(#heroG)" strokeWidth="1" fill="none" opacity="0.3" strokeDasharray="3 6"/>
            {/* Inner orbit */}
            <ellipse cx="32" cy="32" rx="17" ry="17" stroke="url(#heroG)" strokeWidth="0.8" fill="none" opacity="0.2" strokeDasharray="2 5"/>
            {/* Core */}
            <circle cx="32" cy="32" r="6" fill="url(#heroG)" opacity="0.9"/>
            <circle cx="32" cy="32" r="3.5" fill="#00E5FF"/>
            {/* Satellites */}
            <circle cx="54" cy="20" r="3" fill="#00E5FF" opacity="0.85"/>
            <circle cx="10" cy="40" r="2.5" fill="#7B61FF" opacity="0.7"/>
            <circle cx="50" cy="52" r="2" fill="#E040FB" opacity="0.6"/>
            {/* Connection lines */}
            <line x1="36" y1="28" x2="51" y2="21" stroke="url(#heroG)" strokeWidth="0.6" opacity="0.25"/>
            <line x1="28" y1="35" x2="12" y2="39" stroke="url(#heroG)" strokeWidth="0.6" opacity="0.2"/>
            <line x1="36" y1="36" x2="48" y2="50" stroke="url(#heroG)" strokeWidth="0.6" opacity="0.15"/>
          </svg>
        </div>

        {/* Platform Badge */}
        <div className="hero-platform-badge">
          THE ACADEMIC OPERATING SYSTEM
        </div>

        {/* Headline */}
        <h1 className="hero-brand-headline">
          IPUSpace<span className="hero-brand-dot">.</span>
        </h1>

        {/* Sub-headline */}
        <p className="hero-brand-sub">
          The digital campus that transforms how IPU students<br/>
          study, submit, and succeed.
        </p>

        {/* CTAs */}
        <div className="hero-cta-group">
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/lab-generator')}>
            Explore LabCraft
            <ArrowRight size={16} />
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => setIsHiwOpen(true)}>
            <Play size={14} />
            How it works
          </button>
        </div>

        {/* Status Bar */}
        <div className="hero-status-bar">
          <div className="hero-status-item">
            <span className="status-dot live"></span>
            <span className="status-label">LabCraft</span>
            <span className="status-value live">Live</span>
          </div>
          <div className="hero-status-divider"></div>
          <div className="hero-status-item">
            <span className="status-dot upcoming"></span>
            <span className="status-label">PYQSpace</span>
            <span className="status-value upcoming">Coming Soon</span>
          </div>
        </div>
      </motion.section>

      {/* ═══ ACT 2: ECOSYSTEM (Orbital Visualization) ══════════════ */}
      <motion.section
        className="landing-section ecosystem-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-120px' }}
        transition={{ duration: 0.7 }}
      >
        <div className="section-badge">
          Connected Ecosystem
        </div>
        <h2 className="section-title-huge">
          Everything connects.
        </h2>
        <p className="section-desc-premium">
          IPUSpace orchestrates tools that eliminate student busywork. One platform, every academic advantage.
        </p>

        {/* Orbital Canvas */}
        <div className="ecosystem-canvas-container">
          <OrbitalCanvas activeNode={activeNode} setActiveNode={setActiveNode} />
        </div>

        {/* Info Card */}
        <div className="ecosystem-info-drawer">
          <AnimatePresence mode="wait">
            {activeNode === 'ipuspace' && (
              <motion.div
                key="ipuspace-info"
                className="ecosystem-info-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h4>IPUSpace Core</h4>
                <p>The orchestrator that connects student identities, course metadata, and generation histories across all academic tools.</p>
              </motion.div>
            )}
            {activeNode === 'labcraft' && (
              <motion.div
                key="labcraft-info"
                className="ecosystem-info-card cyan"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h4>🧪 LabCraft — Live Flagship</h4>
                <p>Transforms course and branch inputs into structured PDF/DOCX lab reports with fully annotated source code, theories, and viva voce sheets.</p>
              </motion.div>
            )}
            {activeNode === 'pyqspace' && (
              <motion.div
                key="pyqspace-info"
                className="ecosystem-info-card aurora"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h4>📄 PYQSpace — Coming Soon</h4>
                <p>Previous year papers reimagined with solved answers, exam analytics, and priority chapter breakdowns for late-night exam prep.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Capability Cards */}
        <div className="capability-cards">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="capability-card">
              <div className="cap-icon" style={{ color: cap.color }}>{cap.icon}</div>
              <div className="cap-content">
                <h4>{cap.title}</h4>
                <p>{cap.desc}</p>
              </div>
              <span className={`cap-status ${cap.status === 'Live' ? 'live' : 'soon'}`}>
                {cap.status}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* ═══ ACT 3: LABCRAFT SHOWCASE (Pipeline) ═══════════════════ */}
      <motion.section
        className="landing-section labcraft-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
      >
        <div className="section-badge">
          🧪 Flagship Product
        </div>
        <h2 className="section-title-huge">
          See it work.
        </h2>
        <p className="section-desc-premium">
          Select a topic. Watch it transform into a complete academic output.
        </p>

        <div className="pipeline-visual">
          {/* Input Panel */}
          <div className="pipeline-input-panel">
            <div className="pipeline-input-header">
              <h4>System Inputs</h4>
              <span className="pipeline-badge-pulse">
                <Cpu size={10} style={{ marginRight: 4 }} />
                Active
              </span>
            </div>
            {MOCK_TOPICS.map((t) => (
              <div
                key={t.id}
                className={`pipeline-input-item ${selectedTopicId === t.id ? 'active' : ''}`}
                onClick={() => handleSelectTopic(t.id)}
              >
                <div>
                  <div className="label-sec">{t.subject}</div>
                  <div className="val-sec">{t.topic}</div>
                </div>
                <ChevronRight size={16} style={{ opacity: selectedTopicId === t.id ? 1 : 0.3, transition: 'all 0.3s' }} />
              </div>
            ))}
            <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'left' }}>
              Click a topic to simulate the AI transformation pipeline.
            </div>
          </div>

          {/* Output Panel */}
          <div className="pipeline-output-panel">
            {isScanning && <div className="pipeline-scan-beam"></div>}

            <div className="pipeline-output-tabs">
              {['theory', 'code', 'viva', 'ppt'].map((tab) => (
                <button
                  key={tab}
                  className={`pipeline-tab-btn ${activeLabTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveLabTab(tab)}
                >
                  {tab === 'ppt' ? 'Slides' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'code' && ' Code'}
                </button>
              ))}
            </div>

            <div className="pipeline-output-body">
              <AnimatePresence mode="wait">
                {isScanning ? (
                  <motion.div
                    key="scanning"
                    className="pipeline-mock-doc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    style={{ justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}
                  >
                    <div className="spinner" style={{ width: '24px', height: '24px', marginBottom: '10px' }}></div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Processing through Gemini LLM...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${selectedTopicId}-${activeLabTab}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="pipeline-mock-doc"
                  >
                    {activeLabTab === 'theory' && (
                      <>
                        <div className="pipeline-mock-doc-title">
                          <BookOpen size={16} color="#00E5FF" />
                          <span>Structured Experiment Theory</span>
                        </div>
                        <div className="pipeline-mock-doc-content" style={{ textAlign: 'left' }}>
                          {currentTopicData.theory}
                        </div>
                      </>
                    )}
                    {activeLabTab === 'code' && (
                      <>
                        <div className="pipeline-mock-doc-title">
                          <Terminal size={16} color="#34D399" />
                          <span>C++ Source File</span>
                        </div>
                        <pre className="pipeline-mock-code-wrap">
                          <code>{currentTopicData.code}</code>
                        </pre>
                      </>
                    )}
                    {activeLabTab === 'viva' && (
                      <div className="pipeline-viva-qa">
                        <div className="pipeline-mock-doc-title">
                          <HelpCircle size={16} color="#FBBF24" />
                          <span>Common Examiner Viva Questions</span>
                        </div>
                        {currentTopicData.viva.map((v, i) => (
                          <div key={i} className="pipeline-viva-item">
                            <div className="pipeline-q-title">Q: {v.q}</div>
                            <div className="pipeline-q-ans" style={{ color: 'var(--success)' }}>Ans: {v.a}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeLabTab === 'ppt' && (
                      <div className="pipeline-mock-slides-grid">
                        {currentTopicData.slides.map((slide, i) => (
                          <div key={i} className="pipeline-mock-slide" style={{ textAlign: 'left' }}>
                            <h5>{slide.title}</h5>
                            <ul>
                              {slide.points.map((pt, idx) => (
                                <li key={idx}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ═══ ACT 4: PYQSPACE TEASER + PORTAL ═══════════════════════ */}
      <motion.section
        className="landing-section closing-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
      >
        {/* PYQSpace Teaser */}
        <div className="pyq-teaser-card">
          <div className="pyq-teaser-info">
            <span className="pyq-teaser-badge">📄 Coming Soon</span>
            <h3 className="pyq-teaser-headline">
              PYQSpace
              <br />
              <span style={{ color: 'var(--accent)' }}>Built for the nights before exams.</span>
            </h3>
            <p className="pyq-teaser-desc">
              No more scrolling through corrupt PDFs at 2 AM. Previous Year Papers reimagined with step-by-step solutions, mark breakdowns, and priority lists.
            </p>
            <div className="pyq-features-list">
              <div className="pyq-feature-item">
                <span className="pyq-feature-dot"></span>
                <span>Solved answers indexed by syllabus chapter</span>
              </div>
              <div className="pyq-feature-item">
                <span className="pyq-feature-dot"></span>
                <span>Exam distribution analytics and topic priorities</span>
              </div>
              <div className="pyq-feature-item">
                <span className="pyq-feature-dot"></span>
                <span>Optimized night-mode study sheets</span>
              </div>
            </div>
          </div>
          <div className="pyq-teaser-preview">
            <div className="pyq-sheet-header">
              <span className="pyq-sheet-title">Computer Networks (2025 Paper)</span>
              <span className="pyq-sheet-meta">End Term · Dec 2025</span>
            </div>
            <div className="pyq-question-row">
              <div className="pyq-q-title">Q1a. Differentiate between TCP and UDP protocols. [5 Marks]</div>
              <div className="pyq-q-ans">
                <span className="pyq-solved-badge">✓ Solved</span>
                <span style={{ fontSize: '0.65rem' }}>View explanation (2 mins read)</span>
              </div>
            </div>
            <div className="pyq-question-row">
              <div className="pyq-q-title">Q1b. Explain the working of Link State Routing. [5 Marks]</div>
              <div className="pyq-q-ans">
                <span className="pyq-solved-badge">✓ Solved</span>
                <span style={{ fontSize: '0.65rem' }}>Dijkstra simulation attached</span>
              </div>
            </div>
            <div className="pyq-question-row">
              <div className="pyq-q-title">Q2. Find the IP block ranges in CIDR subnetting. [10 Marks]</div>
              <div className="pyq-q-ans">
                <span className="pyq-solved-badge">✓ Solved</span>
                <span style={{ fontSize: '0.65rem' }}>Step-by-step calculations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Portal CTA */}
        <div className="portal-block">
          <div className="portal-glowing-ring">
            <div className="portal-inner-glow"></div>
            <div className="portal-logo">
              <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="portalBrandG" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stopColor="#00E5FF"/>
                    <stop offset="100%" stopColor="#7B61FF"/>
                  </linearGradient>
                </defs>
                <ellipse cx="32" cy="32" rx="24" ry="24" stroke="url(#portalBrandG)" strokeWidth="1.5" fill="none" opacity="0.4"/>
                <circle cx="32" cy="32" r="5" fill="url(#portalBrandG)"/>
                <circle cx="32" cy="32" r="2.5" fill="#00E5FF"/>
                <circle cx="50" cy="18" r="2.5" fill="#00E5FF" opacity="0.7"/>
                <circle cx="14" cy="44" r="2" fill="#E040FB" opacity="0.5"/>
              </svg>
            </div>
          </div>

          <h2 className="portal-headline">Enter IPUSpace.</h2>
          <p className="portal-sub">
            Step into the future of student productivity. Save hundreds of hours, ace your submissions, and dominate your classes.
          </p>

          <div className="portal-cta-row">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/lab-generator')}>
              Launch Lab Generator
              <ArrowRight size={16} />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate('/ppt-generator')}>
              Launch PPT Generator
            </button>
          </div>
        </div>

        {/* Recent History */}
        {history.length > 0 && (
          <div className="recent-history-container slide-up">
            <div className="recent-history-card">
              <div className="history-header" style={{ marginBottom: '14px' }}>
                <h3 className="history-title" style={{ fontSize: '0.9rem' }}>
                  <Clock size={14} style={{ marginRight: 6, opacity: 0.6 }} />
                  Recent Generator Logs
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={clearHistory} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                  Clear History
                </button>
              </div>
              <div className="history-list">
                {history.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="history-item" onClick={() => handleLoadHistory(entry)}>
                    <div className="history-item-icon">{entry.mode === 'experiment' ? '🧪' : '📊'}</div>
                    <div className="history-item-info">
                      <span className="history-item-topic">{entry.topic}</span>
                      <span className="history-item-meta">
                        {entry.subject}
                        {entry.experimentNo ? ` · Exp ${entry.experimentNo}` : ''}
                      </span>
                    </div>
                    <span className="history-item-time">{timeAgo(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={isHiwOpen}
        onClose={() => setIsHiwOpen(false)}
        onStartGenerating={() => navigate('/lab-generator')}
      />
    </div>
  );
}

export default LandingPage;
