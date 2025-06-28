import React, { useEffect, useState } from 'react';
import { fetchFlows } from '../api/flows';
import { executeCommand } from '../api/commands';
import Terminal from '../components/Terminal';
import CommandResult from '../components/CommandResult';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import {
    Workflow,
    Clock,
    FileText,
    Zap,
    Loader2,
    Play
} from 'lucide-react';
import { cn } from '../lib/utils';

type Step = {
    name: string;
    command: string;
    notes?: string;
    skip_prompt?: boolean;
    terminal?: boolean;
};

type Flow = {
    name: string;
    variables: Record<string, string>;
    steps: Step[];
};

type CommandResultType = {
    command: string;
    exit_code: number;
    stdout: string;
    stderr: string;
    duration: number;
    success: boolean;
    executed_at: string;
};

const FlowsPage: React.FC = () => {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [runningStep, setRunningStep] = useState<{ flowIdx: number, stepIdx: number } | null>(null);
    const [showTerminal, setShowTerminal] = useState(false);
    const [executingStep, setExecutingStep] = useState<{ flowIdx: number, stepIdx: number } | null>(null);
    const [commandResult, setCommandResult] = useState<CommandResultType | null>(null);
    const [showCommandResult, setShowCommandResult] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    useEffect(() => {
        fetchFlows()
            .then(setFlows)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const handleRunStep = (flowIdx: number, stepIdx: number) => {
        console.log('handleRunStep called:', flowIdx, stepIdx);
        setRunningStep({ flowIdx, stepIdx });
        setShowTerminal(true);
        setOpenDropdown(null);
    };

    const handleExecuteStep = async (flowIdx: number, stepIdx: number) => {
        console.log('handleExecuteStep called:', flowIdx, stepIdx);
        const step = flows[flowIdx].steps[stepIdx];
        setExecutingStep({ flowIdx, stepIdx });
        setOpenDropdown(null);

        try {
            console.log('Executing command:', step.command);
            const result = await executeCommand(step.command);
            console.log('Command result:', result);
            setCommandResult(result);
            setShowCommandResult(true);
        } catch (error) {
            console.error('Command execution failed:', error);
            // Show error in result format
            setCommandResult({
                command: step.command,
                exit_code: -1,
                stdout: '',
                stderr: error instanceof Error ? error.message : 'Unknown error occurred',
                duration: 0,
                success: false,
                executed_at: new Date().toISOString()
            });
            setShowCommandResult(true);
        } finally {
            setExecutingStep(null);
        }
    };

    const handleTerminalClose = () => {
        setShowTerminal(false);
        setRunningStep(null);
    };

    const handleCommandResultClose = () => {
        setShowCommandResult(false);
        setCommandResult(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading flows...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <Card className="max-w-md mx-auto border-red-200 dark:border-red-800">
                    <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600 dark:text-slate-300">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            {/* Terminal Modal */}
            {showTerminal && runningStep && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl">
                        <Terminal
                            command={flows[runningStep.flowIdx].steps[runningStep.stepIdx].command}
                            onDone={handleTerminalClose}
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            {/* Command Result Modal */}
            {showCommandResult && commandResult && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl">
                        <CommandResult
                            result={commandResult}
                            onClose={handleCommandResultClose}
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            <div className="container mx-auto p-6 h-screen flex flex-col">
                {/* Header */}
                <div className="mb-8 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Workflow className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            DevFlow
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg">
                        Manage your development workflows with ease
                    </p>
                </div>

                {/* Scrollable Flows Area */}
                <ScrollArea className="flex-1">
                    <div className="grid gap-6 pb-6">
                        {flows.map((flow, flowIdx) => (
                            <Card key={flowIdx} className="overflow-hidden border-0 shadow-lg bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-xl text-slate-900 dark:text-white flex items-center gap-2">
                                                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                {flow.name}
                                            </CardTitle>
                                            <CardDescription className="mt-1 flex items-center gap-2">
                                                <Clock className="h-4 w-4" />
                                                {flow.steps.length} steps
                                            </CardDescription>
                                        </div>
                                        <Badge className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                            Ready
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <ScrollArea className="max-h-96 overflow-y-auto">
                                        <div className="space-y-4">
                                            {flow.steps.map((step, stepIdx) => {
                                                const isExecuting = executingStep?.flowIdx === flowIdx && executingStep?.stepIdx === stepIdx;

                                                return (
                                                    <div key={stepIdx} className="group">
                                                        <Card className="transition-all duration-200 hover:shadow-md border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                                                            <CardContent className="p-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium">
                                                                                {stepIdx + 1}
                                                                            </div>
                                                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                                                {step.name}
                                                                            </h3>
                                                                            {step.skip_prompt && (
                                                                                <Badge className="text-xs">
                                                                                    Auto-run
                                                                                </Badge>
                                                                            )}
                                                                        </div>

                                                                        <div className="ml-11">
                                                                            <code className="text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-mono">
                                                                                {step.command}
                                                                            </code>

                                                                            {step.notes && (
                                                                                <details className="mt-2">
                                                                                    <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1">
                                                                                        <FileText className="h-3 w-3" />
                                                                                        Notes
                                                                                    </summary>
                                                                                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                                                                                        <p className="text-sm text-slate-700 dark:text-slate-300">
                                                                                            {step.notes}
                                                                                        </p>
                                                                                    </div>
                                                                                </details>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="ml-4 relative gap-2 flex items-center">
                                                                        {
                                                                            step.terminal && <Button
                                                                                onClick={() => handleRunStep(flowIdx, stepIdx)}
                                                                                disabled={showTerminal || isExecuting}
                                                                                className={cn(
                                                                                    "bg-blue-600 hover:bg-blue-700 text-white shadow-md",
                                                                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                                                                    "group-hover:shadow-lg transition-all duration-200",
                                                                                    "flex items-center gap-2"
                                                                                )}
                                                                            >
                                                                                {isExecuting ? (
                                                                                    <>
                                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                                        Executing...
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Play className="h-4 w-4" />
                                                                                        Open Terminal
                                                                                    </>
                                                                                )}
                                                                            </Button>
                                                                        }
                                                                        {
                                                                            !step.terminal &&
                                                                            <Button
                                                                                onClick={() => handleExecuteStep(flowIdx, stepIdx)}
                                                                                disabled={showTerminal || isExecuting}
                                                                                className={cn(
                                                                                    "bg-blue-600 hover:bg-blue-700 text-white shadow-md",
                                                                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                                                                    "group-hover:shadow-lg transition-all duration-200",
                                                                                    "flex items-center gap-2"
                                                                                )}
                                                                            >
                                                                                {isExecuting ? (
                                                                                    <>
                                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                                        Executing...
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Play className="h-4 w-4" />
                                                                                        Execute & Show Result
                                                                                    </>
                                                                                )}
                                                                            </Button>
                                                                        }


                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                        {stepIdx < flow.steps.length - 1 && (
                                                            <div className="flex justify-center my-2">
                                                                <Separator orientation="vertical" className="h-4 w-4 bg-slate-300 dark:bg-slate-600" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        ))}

                        {flows.length === 0 && (
                            <Card className="max-w-md mx-auto text-center border-dashed">
                                <CardContent className="p-8">
                                    <Workflow className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                        No flows available
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300">
                                        Create your first workflow to get started.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Click outside to close dropdown */}
            {openDropdown && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setOpenDropdown(null)}
                />
            )}
        </div>
    );
};

export default FlowsPage; 