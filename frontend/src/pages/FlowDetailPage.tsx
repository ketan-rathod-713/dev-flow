import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchFlows, updateVariable, deleteVariable, executeStep } from '../api/flows';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import Terminal from '../components/Terminal';
import {
    ArrowLeft,
    Play,
    Loader2,
    Settings,
    Edit3,
    Save,
    X,
    Trash2,
    CheckCircle,
    XCircle,
    Info,
    RotateCcw,
    AlertCircle,
    Terminal as TerminalIcon,
    Zap,
    Code
} from 'lucide-react';

type CommandResultType = 'success' | 'error' | 'info';

type Step = {
    id?: number;
    name: string;
    command: string;
    notes?: string;
    skip_prompt?: boolean;
    terminal?: boolean;
    tmux_session_name?: string;
    is_tmux_terminal?: boolean;
};

type Flow = {
    id?: number;
    name: string;
    variables: Record<string, string>;
    steps: Step[];
};

const FlowDetailPage = () => {
    const { flowName } = useParams<{ flowName: string }>();
    const decodedFlowName = decodeURIComponent(flowName || '');
    const [flow, setFlow] = useState<Flow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [runningStep, setRunningStep] = useState<number | null>(null);
    const [isRunningAll, setIsRunningAll] = useState(false);
    const [executionResults, setExecutionResults] = useState<Record<number, { output: string; type: CommandResultType }>>({});
    const [editableVariables, setEditableVariables] = useState<Record<string, string>>({});
    const [editingVariable, setEditingVariable] = useState<string | null>(null);
    const [savingVariable, setSavingVariable] = useState<string | null>(null);
    const [showTerminalToggle, setShowTerminalToggle] = useState(false);
    const [activeTerminal, setActiveTerminal] = useState<{ stepIndex: number; stepId: number; command: string } | null>(null);

    useEffect(() => {
        console.log('FlowDetailPage: Looking for flow:', decodedFlowName);
        fetchFlows()
            .then(flows => {
                console.log('FlowDetailPage: Available flows:', flows.map((f: Flow) => ({ id: f.id, name: f.name })));
                const foundFlow = flows.find((f: Flow) => f.name === decodedFlowName);
                if (foundFlow) {
                    console.log('FlowDetailPage: Found flow:', foundFlow);
                    setFlow(foundFlow);
                    setEditableVariables({ ...foundFlow.variables });
                } else {
                    console.error('FlowDetailPage: Flow not found:', decodedFlowName);
                    setError(`Flow "${decodedFlowName}" not found`);
                }
            })
            .catch((e: Error) => {
                console.error('FlowDetailPage: Error fetching flows:', e);
                setError(e.message);
            })
            .finally(() => setLoading(false));
    }, [decodedFlowName]);

    const handleVariableChange = (key: string, value: string) => {
        setEditableVariables(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveVariable = async (key: string) => {
        if (!flow?.id) return;

        try {
            setSavingVariable(key);
            await updateVariable(flow.id, key, { key, value: editableVariables[key] });

            // Update the flow state
            setFlow(prev => prev ? {
                ...prev,
                variables: { ...prev.variables, [key]: editableVariables[key] }
            } : null);

            setEditingVariable(null);
            console.log(`Variable ${key} updated successfully`);
        } catch (error) {
            console.error('Failed to save variable:', error);
            setError('Failed to save variable. Please try again.');
        } finally {
            setSavingVariable(null);
        }
    };

    const handleDeleteVariable = async (key: string) => {
        if (!flow?.id) return;

        if (!confirm(`Are you sure you want to delete the variable "${key}"?`)) {
            return;
        }

        try {
            await deleteVariable(flow.id, key);

            // Update local state
            setFlow(prev => {
                if (!prev) return null;
                const newVariables = { ...prev.variables };
                delete newVariables[key];
                return { ...prev, variables: newVariables };
            });

            const newEditableVariables = { ...editableVariables };
            delete newEditableVariables[key];
            setEditableVariables(newEditableVariables);

            console.log(`Variable ${key} deleted successfully`);
        } catch (error) {
            console.error('Failed to delete variable:', error);
            setError('Failed to delete variable. Please try again.');
        }
    };

    const handleRunStep = async (stepIndex: number) => {
        if (!flow || !flow.steps[stepIndex]) return;

        const step = flow.steps[stepIndex];
        setRunningStep(stepIndex);
        setError(null);

        try {
            if (step.terminal || step.is_tmux_terminal) {
                // For terminal steps, open the terminal with the command and step ID
                const finalCommand = step.command;
                setActiveTerminal({
                    stepIndex,
                    stepId: step.id || 0,
                    command: finalCommand
                });
                setExecutionResults(prev => ({
                    ...prev,
                    [stepIndex]: {
                        output: `Terminal opened for: ${step.name}`,
                        type: 'info'
                    }
                }));
                setShowTerminalToggle(true);
            } else {
                // Execute command step without terminal using the new API
                if (step.id) {
                    const result = await executeStep(step.id);
                    setExecutionResults(prev => ({
                        ...prev,
                        [stepIndex]: {
                            output: result.stdout || result.stderr || 'Command executed',
                            type: result.success ? 'success' : 'error'
                        }
                    }));
                } else {
                    setExecutionResults(prev => ({
                        ...prev,
                        [stepIndex]: {
                            output: 'Step ID not available',
                            type: 'error'
                        }
                    }));
                }
            }
        } catch (error: unknown) {
            console.error('Failed to execute step:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to execute step';
            setExecutionResults(prev => ({
                ...prev,
                [stepIndex]: {
                    output: errorMessage,
                    type: 'error'
                }
            }));
        } finally {
            setRunningStep(null);
        }
    };

    const handleRunAllSteps = async () => {
        if (!flow) return;

        setIsRunningAll(true);
        setError(null);
        setExecutionResults({});

        for (let i = 0; i < flow.steps.length; i++) {
            const step = flow.steps[i];
            setRunningStep(i);

            try {
                if (step.terminal || step.is_tmux_terminal) {
                    // For terminal steps, just show info message (can't auto-run terminal steps)
                    setExecutionResults(prev => ({
                        ...prev,
                        [i]: {
                            output: `Terminal step "${step.name}" - Click "Open Terminal" to run manually.`,
                            type: 'info'
                        }
                    }));
                } else {
                    // Execute command step using the new API
                    if (step.id) {
                        const result = await executeStep(step.id);
                        setExecutionResults(prev => ({
                            ...prev,
                            [i]: {
                                output: result.stdout || result.stderr || 'Command executed',
                                type: result.success ? 'success' : 'error'
                            }
                        }));
                    } else {
                        setExecutionResults(prev => ({
                            ...prev,
                            [i]: {
                                output: 'Step ID not available',
                                type: 'error'
                            }
                        }));
                    }
                }
            } catch (error: unknown) {
                console.error(`Failed to execute step ${i}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to execute step';
                setExecutionResults(prev => ({
                    ...prev,
                    [i]: {
                        output: errorMessage,
                        type: 'error'
                    }
                }));
                break; // Stop execution on error
            }

            // Small delay between steps
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        setRunningStep(null);
        setIsRunningAll(false);
        setShowTerminalToggle(true);
    };

    const handleTerminalDone = () => {
        setActiveTerminal(null);
        setShowTerminalToggle(false);
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

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <Card className="max-w-md mx-auto border-red-200 dark:border-red-800">
                    <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600 dark:text-slate-300 mb-4">{error}</p>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => {
                                    setError(null);
                                    setLoading(true);
                                    fetchFlows()
                                        .then(flows => {
                                            const foundFlow = flows.find((f: Flow) => f.name === decodedFlowName);
                                            if (foundFlow) {
                                                setFlow(foundFlow);
                                                setEditableVariables({ ...foundFlow.variables });
                                            } else {
                                                setError(`Flow "${decodedFlowName}" not found`);
                                            }
                                        })
                                        .catch((e: Error) => setError(e.message))
                                        .finally(() => setLoading(false));
                                }}
                                className="flex-1"
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Try Again
                            </Button>
                            <Link to="/flows">
                                <Button variant="outline">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Flows
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!flow) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <Card className="max-w-md mx-auto">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            Flow Not Found
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                            The flow "{decodedFlowName}" could not be found.
                        </p>
                        <Link to="/flows">
                            <Button>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Flows
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const variableEntries = Object.entries(flow.variables);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            {/* Terminal Modal */}
            {activeTerminal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <TerminalIcon className="h-5 w-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Terminal - Step {activeTerminal.stepIndex + 1}
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                    {flow?.steps[activeTerminal.stepIndex]?.name}
                                </Badge>
                            </div>
                            <Button
                                onClick={handleTerminalDone}
                                variant="outline"
                                size="sm"
                                className="p-2"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="p-4">
                            <Terminal
                                command={activeTerminal.command}
                                stepId={activeTerminal.stepId}
                                onDone={handleTerminalDone}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="container mx-auto p-6 max-w-6xl">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Link to="/flows">
                                <Button variant="outline" size="sm">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Flows
                                </Button>
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                        {flow.name}
                                    </h1>
                                    <p className="text-slate-600 dark:text-slate-300">
                                        {flow.steps.length} steps • {variableEntries.length} variables
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {showTerminalToggle && (
                                <Button
                                    onClick={() => setShowTerminalToggle(false)}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <TerminalIcon className="h-4 w-4" />
                                    Terminal
                                </Button>
                            )}
                            <Button
                                onClick={handleRunAllSteps}
                                disabled={isRunningAll || runningStep !== null}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isRunningAll ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Running All Steps...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Run All Steps
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Variables Section */}
                    <div className="lg:col-span-1">
                        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
                                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Settings className="h-5 w-5" />
                                    Variables ({variableEntries.length})
                                </CardTitle>
                                <CardDescription>
                                    Configure flow variables
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4">
                                {variableEntries.length > 0 ? (
                                    <div className="space-y-4">
                                        {variableEntries.map(([key, value]) => (
                                            <div key={key} className="group">
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {key}
                                                    </label>
                                                    <div className="flex items-center gap-1">
                                                        {editingVariable === key ? (
                                                            <>
                                                                <Button
                                                                    onClick={() => handleSaveVariable(key)}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                                                    disabled={savingVariable === key}
                                                                >
                                                                    {savingVariable === key ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <Save className="h-3 w-3" />
                                                                    )}
                                                                </Button>
                                                                <Button
                                                                    onClick={() => {
                                                                        setEditingVariable(null);
                                                                        setEditableVariables(prev => ({ ...prev, [key]: value }));
                                                                    }}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    onClick={() => setEditingVariable(key)}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Edit3 className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    onClick={() => handleDeleteVariable(key)}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <Input
                                                    value={editableVariables[key] || ''}
                                                    onChange={(e) => handleVariableChange(key, e.target.value)}
                                                    disabled={editingVariable !== key}
                                                    className={editingVariable === key ? 'border-blue-300 dark:border-blue-600' : ''}
                                                    placeholder="Variable value"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Settings className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                                            No variables defined for this flow
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Steps Section */}
                    <div className="lg:col-span-2">
                        <Card className="shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
                                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Play className="h-5 w-5" />
                                    Execution Steps ({flow.steps.length})
                                </CardTitle>
                                <CardDescription>
                                    Execute steps individually or run all at once
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {flow.steps.map((step, index) => {
                                        const isRunning = runningStep === index;
                                        const result = executionResults[index];

                                        return (
                                            <div key={index} className="p-6">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-start gap-4 flex-1">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                            {index + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                                                    {step.name}
                                                                </h3>
                                                                <div className="flex gap-1">
                                                                    {step.terminal || step.is_tmux_terminal ? (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <TerminalIcon className="h-3 w-3 mr-1" />
                                                                            {step.is_tmux_terminal ? 'Tmux' : 'Terminal'}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            <Code className="h-3 w-3 mr-1" />
                                                                            Command
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mb-3">
                                                                <code className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                                                                    {step.command}
                                                                </code>
                                                            </div>
                                                            {step.notes && (
                                                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                                                    {step.notes}
                                                                </p>
                                                            )}
                                                            {step.tmux_session_name && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                                                    Tmux Session: <code className="font-mono">{step.tmux_session_name}</code>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {step.terminal || step.is_tmux_terminal ? (
                                                            <Button
                                                                onClick={() => handleRunStep(index)}
                                                                disabled={isRunning || isRunningAll}
                                                                size="sm"
                                                                className="bg-purple-600 hover:bg-purple-700 text-white"
                                                            >
                                                                {isRunning ? (
                                                                    <>
                                                                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                                                        Opening...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <TerminalIcon className="h-3 w-3 mr-2" />
                                                                        Open Terminal
                                                                    </>
                                                                )}
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                onClick={() => handleRunStep(index)}
                                                                disabled={isRunning || isRunningAll}
                                                                size="sm"
                                                                variant="outline"
                                                            >
                                                                {isRunning ? (
                                                                    <>
                                                                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                                                        Executing...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Play className="h-3 w-3 mr-2" />
                                                                        Execute & Show Result
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Execution Result */}
                                                {result && (
                                                    <div className="ml-12">
                                                        <Card className="mt-3 border-slate-200 dark:border-slate-700">
                                                            <CardContent className="p-3">
                                                                <div className="flex items-start gap-2">
                                                                    {result.type === 'success' ? (
                                                                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                                    ) : result.type === 'error' ? (
                                                                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                                    ) : (
                                                                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                                                    )}
                                                                    <div className="flex-1">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={`text-xs mb-2 ${result.type === 'success' ? 'text-green-600 border-green-200' :
                                                                                result.type === 'error' ? 'text-red-600 border-red-200' :
                                                                                    'text-blue-600 border-blue-200'
                                                                                }`}
                                                                        >
                                                                            {result.type === 'success' ? 'Success' :
                                                                                result.type === 'error' ? 'Error' : 'Info'}
                                                                        </Badge>
                                                                        <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-800 p-2 rounded">
                                                                            {result.output}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlowDetailPage; 