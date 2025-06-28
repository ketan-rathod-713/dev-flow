import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
    CheckCircle,
    XCircle,
    Clock,
    Terminal as TerminalIcon,
    Copy,
    AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export interface CommandResult {
    command: string;
    exit_code: number;
    stdout: string;
    stderr: string;
    duration: number;
    success: boolean;
    executed_at: string;
}

interface CommandResultProps {
    result: CommandResult;
    onClose?: () => void;
    className?: string;
}

const CommandResult: React.FC<CommandResultProps> = ({ result, onClose, className }) => {
    const formatDuration = (nanoseconds: number): string => {
        const ms = nanoseconds / 1000000;
        if (ms < 1000) {
            return `${ms.toFixed(2)}ms`;
        }
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const formatTimestamp = (timestamp: string): string => {
        return new Date(timestamp).toLocaleString();
    };

    return (
        <Card className={cn(
            "overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-slate-900 to-slate-800",
            className
        )}>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <TerminalIcon className="h-5 w-5 text-blue-400" />
                            <CardTitle className="text-white">Command Execution Result</CardTitle>
                        </div>
                        <Badge
                            variant={result.success ? "default" : "destructive"}
                            className={cn(
                                "text-xs font-medium",
                                result.success
                                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                                    : "bg-red-500/20 text-red-400 border-red-500/30"
                            )}
                        >
                            <div className={cn(
                                "w-2 h-2 rounded-full mr-2",
                                result.success ? "bg-green-400" : "bg-red-400"
                            )} />
                            {result.success ? "Success" : "Failed"}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDuration(result.duration)}
                        </Badge>
                        {onClose && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                            >
                                <XCircle className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Command Info */}
                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Command:</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(result.command)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                    <code className="block text-sm bg-slate-800 text-slate-200 px-3 py-2 rounded border border-slate-700 font-mono">
                        {result.command}
                    </code>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Exit Code: <span className={cn(
                            "font-mono font-medium",
                            result.exit_code === 0 ? "text-green-400" : "text-red-400"
                        )}>{result.exit_code}</span></span>
                        <span>Executed: {formatTimestamp(result.executed_at)}</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Stdout */}
                {result.stdout && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-400" />
                                <span className="text-sm font-medium text-green-400">Standard Output</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(result.stdout)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                        <ScrollArea className="max-h-48">
                            <pre className="text-sm bg-slate-900/50 text-green-300 p-3 rounded border border-green-500/20 font-mono whitespace-pre-wrap">
                                {result.stdout}
                            </pre>
                        </ScrollArea>
                    </div>
                )}

                {/* Stderr */}
                {result.stderr && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                <span className="text-sm font-medium text-red-400">Standard Error</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(result.stderr)}
                                className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                        <ScrollArea className="max-h-48">
                            <pre className="text-sm bg-slate-900/50 text-red-300 p-3 rounded border border-red-500/20 font-mono whitespace-pre-wrap">
                                {result.stderr}
                            </pre>
                        </ScrollArea>
                    </div>
                )}

                {/* Empty output message */}
                {!result.stdout && !result.stderr && (
                    <div className="text-center py-8">
                        <TerminalIcon className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No output generated</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default CommandResult; 