import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchFlows } from '../api/flows';
import { executeCommand } from '../api/commands';
import Terminal from '../components/Terminal';
import CommandResult from '../components/CommandResult';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import {
    ArrowLeft,
    Clock,
    FileText,
    Loader2,
    Play,
    Zap,
    Save,
    RotateCcw,
    PlayCircle,
    StopCircle
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

const FlowDetailPage: React.FC = () => {
    const { flowId } = useParams();
    const [flow, setFlow] = useState<Flow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [runningStep, setRunningStep] = useState<number | null>(null);
    const [showTerminal, setShowTerminal] = useState(false);
    const [executingStep, setExecutingStep] = useState<number | null>(null);
    const [commandResult, setCommandResult] = useState<CommandResultType | null>(null);
    const [showCommandResult, setShowCommandResult] = useState(false);

    // New state for editable variables
    const [editableVariables, setEditableVariables] = useState<Record<string, string>>({});
    const [originalVariables, setOriginalVariables] = useState<Record<string, string>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Run All Steps state
    const [isRunningAll, setIsRunningAll] = useState(false);
    const [currentRunningStep, setCurrentRunningStep] = useState<number | null>(null);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [failedSteps, setFailedSteps] = useState<Set<number>>(new Set());
    const [runAllResults, setRunAllResults] = useState<Record<number, CommandResultType>>({});

    // Individual step execution state
    const [individuallyCompletedSteps, setIndividuallyCompletedSteps] = useState<Set<number>>(new Set());
    const [individuallyFailedSteps, setIndividuallyFailedSteps] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchFlows()
            .then(flows => {
                const foundFlow = flows.find((f: Flow) => f.name === decodeURIComponent(flowId || ''));
                if (foundFlow) {
                    setFlow(foundFlow);
                    setEditableVariables(foundFlow.variables);
                    setOriginalVariables(foundFlow.variables);
                } else {
                    setError('Flow not found');
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [flowId]);

    // Check for unsaved changes whenever variables change
    useEffect(() => {
        const hasChanges = Object.keys(editableVariables).some(
            key => editableVariables[key] !== originalVariables[key]
        );
        setHasUnsavedChanges(hasChanges);
    }, [editableVariables, originalVariables]);

    const handleVariableChange = (key: string, value: string) => {
        setEditableVariables(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSaveVariables = () => {
        // In a real app, you'd save to backend here
        console.log('Saving variables:', editableVariables);
        setOriginalVariables(editableVariables);
        setHasUnsavedChanges(false);
        // You could show a success toast here
    };

    const handleResetVariables = () => {
        setEditableVariables(originalVariables);
        setHasUnsavedChanges(false);
    };

    const handleRunStep = (stepIdx: number) => {
        console.log('handleRunStep called:', stepIdx);
        setRunningStep(stepIdx);
        setShowTerminal(true);
    };

    const handleExecuteStep = async (stepIdx: number) => {
        console.log('handleExecuteStep called:', stepIdx);
        if (!flow) return;

        const step = flow.steps[stepIdx];
        setExecutingStep(stepIdx);

        // Clear previous individual status for this step
        setIndividuallyCompletedSteps(prev => {
            const newSet = new Set(prev);
            newSet.delete(stepIdx);
            return newSet;
        });
        setIndividuallyFailedSteps(prev => {
            const newSet = new Set(prev);
            newSet.delete(stepIdx);
            return newSet;
        });

        try {
            console.log('Executing command:', step.command);
            console.log('With variables:', editableVariables);
            const result = await executeCommand(step.command, editableVariables);
            console.log('Command result:', result);
            setCommandResult(result);
            setShowCommandResult(true);

            // Mark step as completed or failed based on result
            if (result.success) {
                setIndividuallyCompletedSteps(prev => new Set([...prev, stepIdx]));
                console.log(`Individual step ${stepIdx + 1} completed successfully`);
            } else {
                setIndividuallyFailedSteps(prev => new Set([...prev, stepIdx]));
                console.log(`Individual step ${stepIdx + 1} failed with exit code: ${result.exit_code}`);
            }
        } catch (error) {
            console.error('Command execution failed:', error);
            const errorResult = {
                command: step.command,
                exit_code: -1,
                stdout: '',
                stderr: error instanceof Error ? error.message : 'Unknown error occurred',
                duration: 0,
                success: false,
                executed_at: new Date().toISOString()
            };
            setCommandResult(errorResult);
            setShowCommandResult(true);

            // Mark step as failed
            setIndividuallyFailedSteps(prev => new Set([...prev, stepIdx]));
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

    const handleRunAllSteps = async () => {
        if (!flow || isRunningAll) return;

        setIsRunningAll(true);
        setCurrentRunningStep(0);
        setCompletedSteps(new Set());
        setFailedSteps(new Set());
        setRunAllResults({});

        for (let i = 0; i < flow.steps.length; i++) {
            const step = flow.steps[i];
            setCurrentRunningStep(i);

            try {
                if (step.terminal) {
                    // Handle terminal step
                    console.log(`Running terminal step ${i + 1}: ${step.name}`);
                    setRunningStep(i);
                    setShowTerminal(true);

                    // Wait for 5 seconds for terminal step
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    setShowTerminal(false);
                    setRunningStep(null);

                    // Mark as completed (assuming terminal steps succeed after timeout)
                    setCompletedSteps(prev => new Set([...prev, i]));
                } else {
                    // Handle command execution step
                    console.log(`Executing command step ${i + 1}: ${step.name}`);
                    console.log('With variables:', editableVariables);

                    const result = await executeCommand(step.command, editableVariables);

                    // Store result
                    setRunAllResults(prev => ({
                        ...prev,
                        [i]: result
                    }));

                    if (result.success) {
                        setCompletedSteps(prev => new Set([...prev, i]));
                        console.log(`Step ${i + 1} completed successfully`);
                    } else {
                        setFailedSteps(prev => new Set([...prev, i]));
                        console.log(`Step ${i + 1} failed with exit code: ${result.exit_code}`);

                        // Continue to next step even if current one fails
                        // You can change this behavior if you want to stop on failure
                    }
                }

                // Small delay between steps for better UX
                if (i < flow.steps.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`Error executing step ${i + 1}:`, error);
                setFailedSteps(prev => new Set([...prev, i]));

                // Store error result
                setRunAllResults(prev => ({
                    ...prev,
                    [i]: {
                        command: step.command,
                        exit_code: -1,
                        stdout: '',
                        stderr: error instanceof Error ? error.message : 'Unknown error occurred',
                        duration: 0,
                        success: false,
                        executed_at: new Date().toISOString()
                    }
                }));
            }
        }

        // Finished running all steps
        setIsRunningAll(false);
        setCurrentRunningStep(null);

        console.log('All steps execution completed');
        console.log('Completed steps:', completedSteps);
        console.log('Failed steps:', failedSteps);
    };

    const handleStopRunAll = () => {
        setIsRunningAll(false);
        setCurrentRunningStep(null);
        setShowTerminal(false);
        setRunningStep(null);
        console.log('Run all steps stopped by user');
    };

    const getStepStatus = (stepIndex: number) => {
        if (currentRunningStep === stepIndex) return 'running';
        if (completedSteps.has(stepIndex) || individuallyCompletedSteps.has(stepIndex)) return 'completed';
        if (failedSteps.has(stepIndex) || individuallyFailedSteps.has(stepIndex)) return 'failed';
        return 'pending';
    };

    const getStepStatusBadge = (stepIndex: number) => {
        const status = getStepStatus(stepIndex);
        switch (status) {
            case 'running':
                return <Badge className="text-xs bg-blue-500">Running...</Badge>;
            case 'completed':
                return <Badge className="text-xs bg-green-500">Completed</Badge>;
            case 'failed':
                return <Badge className="text-xs bg-red-500">Failed</Badge>;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading flow...</p>
                </div>
            </div>
        );
    }

    if (error || !flow) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <Card className="max-w-md mx-auto border-red-200 dark:border-red-800">
                    <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600 dark:text-slate-300">{error || 'Flow not found'}</p>
                        <Link to="/" className="mt-4 inline-block">
                            <Button variant="outline">Back to Flows</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            {/* Terminal Modal */}
            {showTerminal && runningStep !== null && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl">
                        <Terminal
                            command={flow.steps[runningStep].command}
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

            <div className="container mx-auto p-6 max-w-4xl">
                {/* Header */}
                <div className="mb-6">
                    <Link to="/">
                        <Button variant="outline" className="mb-4 flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Flows
                        </Button>
                    </Link>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            {flow.name}
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {flow.steps.length} steps
                    </p>
                </div>

                {/* Variables Section */}
                {Object.keys(flow.variables).length > 0 && (
                    <Card className="mb-6">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Variables</CardTitle>
                            {hasUnsavedChanges && (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleResetVariables}
                                        variant="outline"
                                        size="sm"
                                        className="flex items-center gap-1"
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Reset
                                    </Button>
                                    <Button
                                        onClick={handleSaveVariables}
                                        size="sm"
                                        className="flex items-center gap-1"
                                    >
                                        <Save className="h-3 w-3" />
                                        Save
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {Object.entries(flow.variables).map(([key, originalValue]) => (
                                    <div key={key} className="flex items-center gap-3">
                                        <Badge variant="outline" className="min-w-fit">
                                            {key}
                                        </Badge>
                                        <input
                                            type="text"
                                            value={editableVariables[key] || ''}
                                            onChange={(e) => handleVariableChange(key, e.target.value)}
                                            placeholder={`Enter ${key} value`}
                                            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        {editableVariables[key] !== originalValue && (
                                            <Badge variant="secondary" className="text-xs">
                                                Modified
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {hasUnsavedChanges && (
                                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-md border border-yellow-200 dark:border-yellow-800">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                        You have unsaved changes. Don't forget to save your variables.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Steps Section */}
                <Card className="mb-6">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Steps</CardTitle>
                        <div className="flex gap-2">
                            {isRunningAll ? (
                                <Button
                                    onClick={handleStopRunAll}
                                    variant="outline"
                                    className="flex items-center gap-2 text-red-600 hover:text-red-700"
                                >
                                    <StopCircle className="h-4 w-4" />
                                    Stop All
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleRunAllSteps}
                                    disabled={!flow || flow.steps.length === 0}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                >
                                    <PlayCircle className="h-4 w-4" />
                                    Run All Steps
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        {isRunningAll && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Running all steps... Step {(currentRunningStep || 0) + 1} of {flow.steps.length}
                                </p>
                            </div>
                        )}

                        <ScrollArea className="max-h-96 overflow-y-auto">
                            <div className="space-y-4">
                                {flow.steps.map((step, stepIdx) => {
                                    const isExecuting = executingStep === stepIdx || currentRunningStep === stepIdx;
                                    const stepStatus = getStepStatus(stepIdx);

                                    return (
                                        <div key={stepIdx} className="group">
                                            <Card className={cn(
                                                "transition-all duration-200 hover:shadow-md border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50",
                                                stepStatus === 'running' && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/50",
                                                stepStatus === 'completed' && "border-green-500 bg-green-50/50 dark:bg-green-950/50",
                                                stepStatus === 'failed' && "border-red-500 bg-red-50/50 dark:bg-red-950/50"
                                            )}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className={cn(
                                                                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                                                                    stepStatus === 'running' && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                                                                    stepStatus === 'completed' && "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
                                                                    stepStatus === 'failed' && "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
                                                                    stepStatus === 'pending' && "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                                )}>
                                                                    {stepStatus === 'running' ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        stepIdx + 1
                                                                    )}
                                                                </div>
                                                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                                                    {step.name}
                                                                </h3>
                                                                {step.skip_prompt && (
                                                                    <Badge className="text-xs">
                                                                        Auto-run
                                                                    </Badge>
                                                                )}
                                                                {getStepStatusBadge(stepIdx)}
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

                                                                {/* Show result for failed steps */}
                                                                {runAllResults[stepIdx] && !runAllResults[stepIdx].success && (
                                                                    <details className="mt-2">
                                                                        <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 flex items-center gap-1">
                                                                            <FileText className="h-3 w-3" />
                                                                            Error Details
                                                                        </summary>
                                                                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
                                                                            <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                                                                                {runAllResults[stepIdx].stderr || 'Command failed'}
                                                                            </p>
                                                                        </div>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="ml-4 relative gap-2 flex items-center">
                                                            {step.terminal && (
                                                                <Button
                                                                    onClick={() => handleRunStep(stepIdx)}
                                                                    disabled={showTerminal || isExecuting || isRunningAll}
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
                                                            )}
                                                            {!step.terminal && (
                                                                <Button
                                                                    onClick={() => handleExecuteStep(stepIdx)}
                                                                    disabled={showTerminal || isExecuting || isRunningAll}
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
                                                            )}
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
            </div>
        </div>
    );
};

export default FlowDetailPage; 