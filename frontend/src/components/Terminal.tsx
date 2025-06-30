import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader } from './ui/card';
import { Terminal as TerminalIcon, X, Trash2, Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import 'xterm/css/xterm.css';

interface TerminalProps {
    command?: string;
    stepId?: number;
    onDone?: () => void;
    className?: string;
}

const Terminal: React.FC<TerminalProps> = ({ command, stepId, onDone, className }) => {
    const xtermRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerm>(new XTerm());
    const wsRef = useRef<WebSocket>(new WebSocket('ws://localhost:24050/api/shell'));
    const fitAddonRef = useRef<FitAddon>(new FitAddon());
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!xtermRef.current) return;

        // Initialize terminal with modern theme
        termRef.current = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
            theme: {
                background: '#0a0a0a',
                foreground: '#ffffff',
                cursor: '#3b82f6',
                cursorAccent: '#1e40af',
                black: '#000000',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#ffffff',
                brightBlack: '#374151',
                brightRed: '#f87171',
                brightGreen: '#4ade80',
                brightYellow: '#facc15',
                brightBlue: '#60a5fa',
                brightMagenta: '#c084fc',
                brightCyan: '#22d3ee',
                brightWhite: '#f9fafb'
            },
            cols: 120,
            rows: 30,
            scrollback: 1000,
            allowTransparency: true
        });

        fitAddonRef.current = new FitAddon();
        termRef.current.loadAddon(fitAddonRef.current);

        termRef.current.open(xtermRef.current);

        if (fitAddonRef.current) {
            fitAddonRef.current.fit();
        }

        // Build WebSocket URL with command and step_id parameters
        const params = new URLSearchParams();
        if (stepId) {
            params.append('step_id', stepId.toString());
        }

        const wsUrl = `ws://localhost:24050/api/shell${params.toString() ? '?' + params.toString() : ''}`;

        console.log('[Terminal] Connecting to:', wsUrl);

        // Initialize WebSocket connection
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            console.log('[Terminal] WebSocket connected');
            setIsConnected(true);
            setConnectionStatus('Connected');
            termRef.current?.write('\x1b[32m✓ Connected to shell\x1b[0m\r\n');
            if (stepId) {
                termRef.current?.write(`\x1b[36m→ Environment variables loaded from step ${stepId}\x1b[0m\r\n`);
            }
            if (command) {
                termRef.current?.write(`\x1b[36m→ Executing: ${command}\x1b[0m\r\n`);
            }
        };

        wsRef.current.onmessage = (event) => {
            try {
                const decodedData = atob(event.data);
                termRef.current?.write(decodedData);
            } catch (error) {
                console.error('[Terminal] Error decoding message:', error);
            }
        };

        wsRef.current.onerror = (error) => {
            console.error('[Terminal] WebSocket error:', error);
            setConnectionStatus('Connection Error');
            termRef.current?.write('\r\n\x1b[31m✗ WebSocket connection error\x1b[0m\r\n');
        };

        wsRef.current.onclose = (event) => {
            console.log('[Terminal] WebSocket closed:', event.code, event.reason);
            setIsConnected(false);
            setConnectionStatus('Disconnected');
            termRef.current?.write('\r\n\x1b[33m⚠ Shell connection closed\x1b[0m\r\n');
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            onDone && onDone();
        };

        // Handle terminal input with base64 encoding
        const handleTerminalData = (data: string) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                const encodedData = btoa(data);
                wsRef.current.send(encodedData);
            } else {
                console.warn('[Terminal] WebSocket not ready, cannot send data');
            }
        };

        termRef.current.onData(handleTerminalData);

        // Handle window resize
        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
            termRef.current?.dispose();
        };
    }, [command, stepId, onDone]);

    const handleExit = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const exitCommand = btoa('exit\r');
            wsRef.current.send(exitCommand);
            setTimeout(() => {
                wsRef.current?.close();
            }, 100);
        } else {
            wsRef.current?.close();
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            onDone && onDone();
        }
    };

    const handleClear = () => {
        termRef.current?.clear();
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    return (
        <Card className={cn(
            "overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800",
            isFullscreen && "fixed inset-4 z-50",
            className
        )}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <TerminalIcon className="h-5 w-5 text-blue-400" />
                            <span className="font-semibold text-white">Terminal</span>
                        </div>
                        <Badge
                            variant={isConnected ? "default" : "destructive"}
                            className={cn(
                                "text-xs font-medium",
                                isConnected
                                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                                    : "bg-red-500/20 text-red-400 border-red-500/30"
                            )}
                        >
                            <div className={cn(
                                "w-2 h-2 rounded-full mr-2",
                                isConnected ? "bg-green-400" : "bg-red-400"
                            )} />
                            {connectionStatus}
                        </Badge>
                        {command && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30">
                                Auto-exec: {command.length > 30 ? `${command.substring(0, 30)}...` : command}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleFullscreen}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                            <Maximize2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExit}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div
                    ref={xtermRef}
                    className={cn(
                        "bg-black/90 backdrop-blur-sm",
                        isFullscreen ? "h-[calc(100vh-120px)]" : "h-[500px]"
                    )}
                />
            </CardContent>
        </Card>
    );
};

export default Terminal; 