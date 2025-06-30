import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import {
    X,
    Plus,
    Trash2,
    Save,
    FileText,
    Settings,
    Terminal,
    Play,
    Edit3,
    Check,
    AlertCircle,
    GripVertical
} from 'lucide-react';
import { updateFlow, updateStep, createStep, deleteStep, updateVariable, deleteVariable } from '../api/flows';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

type EditFlowModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (updatedFlow: Flow) => void;
    flow: Flow | null;
};

// Sortable Step Item Component
const SortableStepItem: React.FC<{
    step: Step;
    index: number;
    editingStepIndex: number | null;
    setEditingStepIndex: (index: number | null) => void;
    steps: Step[];
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>;
    handleUpdateStep: (index: number, step: Step) => void;
    handleRemoveStep: (index: number) => void;
    loading: boolean;
}> = ({ step, index, editingStepIndex, setEditingStepIndex, steps, setSteps, handleUpdateStep, handleRemoveStep, loading }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: index.toString() });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md"
        >
            {editingStepIndex === index ? (
                // Edit mode
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-md space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Step Name *
                            </label>
                            <input
                                type="text"
                                value={step.name}
                                onChange={(e) => {
                                    const updatedSteps = [...steps];
                                    updatedSteps[index] = { ...step, name: e.target.value };
                                    setSteps(updatedSteps);
                                }}
                                placeholder="Enter step name"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Command *
                            </label>
                            <input
                                type="text"
                                value={step.command}
                                onChange={(e) => {
                                    const updatedSteps = [...steps];
                                    updatedSteps[index] = { ...step, command: e.target.value };
                                    setSteps(updatedSteps);
                                }}
                                placeholder="Enter command"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={step.notes || ''}
                            onChange={(e) => {
                                const updatedSteps = [...steps];
                                updatedSteps[index] = { ...step, notes: e.target.value };
                                setSteps(updatedSteps);
                            }}
                            placeholder="Enter step notes"
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={loading}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={step.skip_prompt}
                                onChange={(e) => {
                                    const updatedSteps = [...steps];
                                    updatedSteps[index] = { ...step, skip_prompt: e.target.checked };
                                    setSteps(updatedSteps);
                                }}
                                className="rounded border-slate-300 dark:border-slate-600"
                                disabled={loading}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Auto-run</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={step.terminal}
                                onChange={(e) => {
                                    const updatedSteps = [...steps];
                                    updatedSteps[index] = { ...step, terminal: e.target.checked };
                                    setSteps(updatedSteps);
                                }}
                                className="rounded border-slate-300 dark:border-slate-600"
                                disabled={loading}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Terminal className="h-3 w-3" />
                                Terminal mode
                            </span>
                        </label>
                    </div>

                    {/* Tmux Terminal Fields */}
                    {step.terminal && (
                        <div className="space-y-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600">
                            <div className="flex items-center gap-2 mb-2">
                                <Terminal className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Terminal Configuration</span>
                            </div>

                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={step.is_tmux_terminal}
                                    onChange={(e) => {
                                        const updatedSteps = [...steps];
                                        updatedSteps[index] = { ...step, is_tmux_terminal: e.target.checked };
                                        setSteps(updatedSteps);
                                    }}
                                    className="rounded border-slate-300 dark:border-slate-600"
                                    disabled={loading}
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">Use Tmux Terminal</span>
                            </label>

                            {step.is_tmux_terminal && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Tmux Session Name
                                    </label>
                                    <input
                                        type="text"
                                        value={step.tmux_session_name || ''}
                                        onChange={(e) => {
                                            const updatedSteps = [...steps];
                                            updatedSteps[index] = { ...step, tmux_session_name: e.target.value };
                                            setSteps(updatedSteps);
                                        }}
                                        placeholder="e.g., dev-session, ${PROJECT_NAME}"
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={loading}
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        You can use variables like ${"{"}SESSION_NAME{"}"} in the session name
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            onClick={() => handleUpdateStep(index, step)}
                            size="sm"
                            className="flex items-center gap-1"
                            disabled={loading}
                        >
                            <Check className="h-3 w-3" />
                            Save Changes
                        </Button>
                        <Button
                            onClick={() => setEditingStepIndex(null)}
                            variant="outline"
                            size="sm"
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                // View mode
                <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="flex items-center justify-center w-6 h-6 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                        <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                                {index + 1}
                            </Badge>
                            <span className="font-medium text-slate-900 dark:text-white">
                                {step.name}
                            </span>
                            {step.skip_prompt && (
                                <Badge className="text-xs">Auto-run</Badge>
                            )}
                            {step.terminal && (
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <Terminal className="h-2 w-2" />
                                    {step.is_tmux_terminal ? 'Tmux' : 'Terminal'}
                                </Badge>
                            )}
                            {step.is_tmux_terminal && step.tmux_session_name && (
                                <Badge variant="outline" className="text-xs">
                                    Session: {step.tmux_session_name}
                                </Badge>
                            )}
                        </div>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-mono">
                            {step.command}
                        </code>
                        {step.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {step.notes}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-1">
                        <Button
                            onClick={() => setEditingStepIndex(index)}
                            variant="outline"
                            size="sm"
                            className="p-1"
                            disabled={loading}
                        >
                            <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                            onClick={() => handleRemoveStep(index)}
                            variant="outline"
                            size="sm"
                            className="p-1 text-red-600 hover:text-red-700"
                            disabled={loading}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const EditFlowModal: React.FC<EditFlowModalProps> = ({ isOpen, onClose, onSubmit, flow }) => {
    const [flowName, setFlowName] = useState('');
    const [flowDescription, setFlowDescription] = useState('');
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [steps, setSteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Variable management
    const [newVarKey, setNewVarKey] = useState('');
    const [newVarValue, setNewVarValue] = useState('');

    // Step management
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [newStep, setNewStep] = useState<Step>({
        name: '',
        command: '',
        notes: '',
        skip_prompt: false,
        terminal: false,
        tmux_session_name: '',
        is_tmux_terminal: false
    });

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Handle drag end to reorder steps
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = parseInt(active.id as string);
        const newIndex = parseInt(over.id as string);

        if (oldIndex !== newIndex) {
            const reorderedSteps = arrayMove(steps, oldIndex, newIndex);
            setSteps(reorderedSteps);

            // Update order_index for all affected steps in the backend
            try {
                setLoading(true);

                // Update all steps with their new order_index
                const updatePromises = reorderedSteps.map((step, index) => {
                    if (step.id) {
                        return updateStep(step.id, {
                            name: step.name,
                            command: step.command,
                            notes: step.notes || '',
                            skip_prompt: step.skip_prompt || false,
                            terminal: step.terminal || false,
                            tmux_session_name: step.tmux_session_name || '',
                            is_tmux_terminal: step.is_tmux_terminal || false,
                            order_index: index
                        });
                    }
                    return Promise.resolve();
                });

                await Promise.all(updatePromises);
            } catch (error) {
                console.error('Failed to update step order:', error);
                setError('Failed to update step order');
                // Revert the local state on error
                setSteps(steps);
            } finally {
                setLoading(false);
            }
        }
    };

    // Initialize form when flow changes
    useEffect(() => {
        if (flow && isOpen) {
            setFlowName(flow.name);
            setFlowDescription('');
            setVariables(flow.variables || {});
            setSteps(flow.steps || []);
            setError(null);
        }
    }, [flow, isOpen]);

    const handleAddVariable = async () => {
        if (newVarKey.trim() && !variables[newVarKey] && flow?.id) {
            try {
                setLoading(true);
                await updateVariable(flow.id, newVarKey, {
                    key: newVarKey,
                    value: newVarValue
                });

                setVariables(prev => ({
                    ...prev,
                    [newVarKey]: newVarValue
                }));
                setNewVarKey('');
                setNewVarValue('');
            } catch (error) {
                console.error('Failed to add variable:', error);
                setError('Failed to add variable');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRemoveVariable = async (key: string) => {
        if (flow?.id) {
            try {
                setLoading(true);
                await deleteVariable(flow.id, key);

                setVariables(prev => {
                    const newVars = { ...prev };
                    delete newVars[key];
                    return newVars;
                });
            } catch (error) {
                console.error('Failed to delete variable:', error);
                setError('Failed to delete variable');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpdateVariable = async (key: string, value: string) => {
        if (flow?.id) {
            try {
                await updateVariable(flow.id, key, {
                    key: key,
                    value: value
                });

                setVariables(prev => ({
                    ...prev,
                    [key]: value
                }));
            } catch (error) {
                console.error('Failed to update variable:', error);
                setError('Failed to update variable');
            }
        }
    };

    const handleAddStep = async () => {
        if (newStep.name.trim() && newStep.command.trim() && flow?.id) {
            try {
                setLoading(true);
                const createdStep = await createStep({
                    flow_id: flow.id,
                    name: newStep.name,
                    command: newStep.command,
                    notes: newStep.notes || '',
                    skip_prompt: newStep.skip_prompt || false,
                    terminal: newStep.terminal || false,
                    tmux_session_name: newStep.tmux_session_name || '',
                    is_tmux_terminal: newStep.is_tmux_terminal || false,
                    order_index: steps.length
                });

                setSteps(prev => [...prev, { ...newStep, id: createdStep.id }]);
                setNewStep({
                    name: '',
                    command: '',
                    notes: '',
                    skip_prompt: false,
                    terminal: false,
                    tmux_session_name: '',
                    is_tmux_terminal: false
                });
            } catch (error) {
                console.error('Failed to add step:', error);
                setError('Failed to add step');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRemoveStep = async (index: number) => {
        const step = steps[index];
        if (step.id) {
            try {
                setLoading(true);
                await deleteStep(step.id);
                setSteps(prev => prev.filter((_, i) => i !== index));
            } catch (error) {
                console.error('Failed to delete step:', error);
                setError('Failed to delete step');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpdateStep = async (index: number, updatedStep: Step) => {
        if (updatedStep.id) {
            try {
                setLoading(true);
                await updateStep(updatedStep.id, {
                    name: updatedStep.name,
                    command: updatedStep.command,
                    notes: updatedStep.notes || '',
                    skip_prompt: updatedStep.skip_prompt || false,
                    terminal: updatedStep.terminal || false,
                    tmux_session_name: updatedStep.tmux_session_name || '',
                    is_tmux_terminal: updatedStep.is_tmux_terminal || false,
                    order_index: index
                });

                setSteps(prev => prev.map((step, i) => i === index ? updatedStep : step));
                setEditingStepIndex(null);
            } catch (error) {
                console.error('Failed to update step:', error);
                setError('Failed to update step');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSubmit = async () => {
        if (flowName.trim() && flow?.id) {
            try {
                setLoading(true);
                await updateFlow(flow.id, {
                    name: flowName,
                    description: flowDescription,
                    variables: variables
                });

                const updatedFlow = {
                    ...flow,
                    name: flowName,
                    variables: variables,
                    steps: steps
                };

                onSubmit(updatedFlow);
                handleClose();
            } catch (error) {
                console.error('Failed to update flow:', error);
                setError('Failed to update flow');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleClose = () => {
        setFlowName('');
        setFlowDescription('');
        setVariables({});
        setSteps([]);
        setNewVarKey('');
        setNewVarValue('');
        setNewStep({
            name: '',
            command: '',
            notes: '',
            skip_prompt: false,
            terminal: false,
            tmux_session_name: '',
            is_tmux_terminal: false
        });
        setEditingStepIndex(null);
        setError(null);
        onClose();
    };

    if (!isOpen || !flow) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Flow</h2>
                    <Button
                        onClick={handleClose}
                        variant="outline"
                        size="sm"
                        className="p-2"
                        disabled={loading}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                )}

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Flow Details Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Flow Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Flow Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={flowName}
                                            onChange={(e) => setFlowName(e.target.value)}
                                            placeholder="Enter flow name"
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Description (Optional)
                                        </label>
                                        <textarea
                                            value={flowDescription}
                                            onChange={(e) => setFlowDescription(e.target.value)}
                                            placeholder="Enter flow description"
                                            rows={3}
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Variables Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5" />
                                    Variables
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Add Variable Form */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newVarKey}
                                            onChange={(e) => setNewVarKey(e.target.value)}
                                            placeholder="Variable name"
                                            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                        <input
                                            type="text"
                                            value={newVarValue}
                                            onChange={(e) => setNewVarValue(e.target.value)}
                                            placeholder="Default value"
                                            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                        <Button
                                            onClick={handleAddVariable}
                                            disabled={!newVarKey.trim() || loading}
                                            size="sm"
                                            className="flex items-center gap-1"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add
                                        </Button>
                                    </div>

                                    {/* Variables List */}
                                    {Object.keys(variables).length > 0 && (
                                        <div className="space-y-2">
                                            {Object.entries(variables).map(([key, value]) => (
                                                <div key={key} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
                                                    <Badge variant="outline" className="min-w-fit">
                                                        {key}
                                                    </Badge>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => handleUpdateVariable(key, e.target.value)}
                                                        className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        disabled={loading}
                                                    />
                                                    <Button
                                                        onClick={() => handleRemoveVariable(key)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="p-1 text-red-600 hover:text-red-700"
                                                        disabled={loading}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Steps Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Play className="h-5 w-5" />
                                    Steps
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Add Step Form */}
                                    <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-md space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                    Step Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newStep.name}
                                                    onChange={(e) => setNewStep(prev => ({ ...prev, name: e.target.value }))}
                                                    placeholder="Enter step name"
                                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                    Command *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newStep.command}
                                                    onChange={(e) => setNewStep(prev => ({ ...prev, command: e.target.value }))}
                                                    placeholder="Enter command"
                                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Notes (Optional)
                                            </label>
                                            <textarea
                                                value={newStep.notes}
                                                onChange={(e) => setNewStep(prev => ({ ...prev, notes: e.target.value }))}
                                                placeholder="Enter step notes"
                                                rows={2}
                                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={newStep.skip_prompt}
                                                    onChange={(e) => setNewStep(prev => ({ ...prev, skip_prompt: e.target.checked }))}
                                                    className="rounded border-slate-300 dark:border-slate-600"
                                                    disabled={loading}
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300">Auto-run</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={newStep.terminal}
                                                    onChange={(e) => setNewStep(prev => ({ ...prev, terminal: e.target.checked }))}
                                                    className="rounded border-slate-300 dark:border-slate-600"
                                                    disabled={loading}
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                    <Terminal className="h-3 w-3" />
                                                    Terminal mode
                                                </span>
                                            </label>
                                        </div>

                                        {/* Tmux Terminal Fields */}
                                        {newStep.terminal && (
                                            <div className="space-y-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Terminal className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Terminal Configuration</span>
                                                </div>

                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={newStep.is_tmux_terminal}
                                                        onChange={(e) => setNewStep(prev => ({ ...prev, is_tmux_terminal: e.target.checked }))}
                                                        className="rounded border-slate-300 dark:border-slate-600"
                                                        disabled={loading}
                                                    />
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">Use Tmux Terminal</span>
                                                </label>

                                                {newStep.is_tmux_terminal && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                            Tmux Session Name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={newStep.tmux_session_name}
                                                            onChange={(e) => setNewStep(prev => ({ ...prev, tmux_session_name: e.target.value }))}
                                                            placeholder="e.g., dev-session, ${PROJECT_NAME}"
                                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                            disabled={loading}
                                                        />
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                            You can use variables like ${"{"}SESSION_NAME{"}"} in the session name
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleAddStep}
                                            disabled={!newStep.name.trim() || !newStep.command.trim() || loading}
                                            className="w-full flex items-center gap-1"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Step
                                        </Button>
                                    </div>

                                    {/* Steps List */}
                                    {steps.length > 0 && (
                                        <div className="space-y-3">
                                            <Separator />
                                            <h4 className="font-medium text-slate-900 dark:text-white">Steps ({steps.length})</h4>
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <SortableContext
                                                    items={steps.map((_, index) => index.toString())}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    {steps.map((step, index) => (
                                                        <SortableStepItem
                                                            key={index}
                                                            step={step}
                                                            index={index}
                                                            editingStepIndex={editingStepIndex}
                                                            setEditingStepIndex={setEditingStepIndex}
                                                            steps={steps}
                                                            setSteps={setSteps}
                                                            handleUpdateStep={handleUpdateStep}
                                                            handleRemoveStep={handleRemoveStep}
                                                            loading={loading}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        {steps.length} step{steps.length !== 1 ? 's' : ''} • {Object.keys(variables).length} variable{Object.keys(variables).length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleClose}
                            variant="outline"
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!flowName.trim() || loading}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditFlowModal; 