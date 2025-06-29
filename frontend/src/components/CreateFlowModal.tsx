import React, { useState } from 'react';
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
    Play
} from 'lucide-react';

type Step = {
    name: string;
    command: string;
    notes?: string;
    skip_prompt?: boolean;
    terminal?: boolean;
    tmux_session_name?: string;
    is_tmux_terminal?: boolean;
};

type CreateFlowModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (flow: { name: string; variables: Record<string, string>; steps: Step[] }) => void;
};

const CreateFlowModal: React.FC<CreateFlowModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [flowName, setFlowName] = useState('');
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [steps, setSteps] = useState<Step[]>([]);

    // Variable management
    const [newVarKey, setNewVarKey] = useState('');
    const [newVarValue, setNewVarValue] = useState('');

    // Step management
    const [newStep, setNewStep] = useState<Step>({
        name: '',
        command: '',
        notes: '',
        skip_prompt: false,
        terminal: false,
        tmux_session_name: '',
        is_tmux_terminal: false
    });

    const handleAddVariable = () => {
        if (newVarKey.trim() && !variables[newVarKey]) {
            setVariables(prev => ({
                ...prev,
                [newVarKey]: newVarValue
            }));
            setNewVarKey('');
            setNewVarValue('');
        }
    };

    const handleRemoveVariable = (key: string) => {
        setVariables(prev => {
            const newVars = { ...prev };
            delete newVars[key];
            return newVars;
        });
    };

    const handleUpdateVariable = (key: string, value: string) => {
        setVariables(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleAddStep = () => {
        if (newStep.name.trim() && newStep.command.trim()) {
            setSteps(prev => [...prev, { ...newStep }]);
            setNewStep({
                name: '',
                command: '',
                notes: '',
                skip_prompt: false,
                terminal: false,
                tmux_session_name: '',
                is_tmux_terminal: false
            });
        }
    };

    const handleRemoveStep = (index: number) => {
        setSteps(prev => prev.filter((_, i) => i !== index));
    };

    // const handleUpdateStep = (index: number, updatedStep: Step) => {
    //     setSteps(prev => prev.map((step, i) => i === index ? updatedStep : step));
    // };

    const handleSubmit = () => {
        if (flowName.trim() && steps.length > 0) {
            onSubmit({
                name: flowName,
                variables,
                steps
            });
            // Reset form
            setFlowName('');
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
            onClose();
        }
    };

    const handleClose = () => {
        // Reset form on close
        setFlowName('');
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
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create New Flow</h2>
                    <Button
                        onClick={handleClose}
                        variant="outline"
                        size="sm"
                        className="p-2"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Flow Name Section */}
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
                                        />
                                        <input
                                            type="text"
                                            value={newVarValue}
                                            onChange={(e) => setNewVarValue(e.target.value)}
                                            placeholder="Default value"
                                            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <Button
                                            onClick={handleAddVariable}
                                            disabled={!newVarKey.trim()}
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
                                                    />
                                                    <Button
                                                        onClick={() => handleRemoveVariable(key)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="p-1 text-red-600 hover:text-red-700"
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
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={newStep.skip_prompt}
                                                    onChange={(e) => setNewStep(prev => ({ ...prev, skip_prompt: e.target.checked }))}
                                                    className="rounded border-slate-300 dark:border-slate-600"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300">Auto-run</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={newStep.terminal}
                                                    onChange={(e) => setNewStep(prev => ({ ...prev, terminal: e.target.checked }))}
                                                    className="rounded border-slate-300 dark:border-slate-600"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                    <Terminal className="h-3 w-3" />
                                                    Terminal mode
                                                </span>
                                            </label>
                                        </div>

                                        {/* Tmux Terminal Fields - Only show when terminal mode is enabled */}
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
                                            disabled={!newStep.name.trim() || !newStep.command.trim()}
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
                                            {steps.map((step, index) => (
                                                <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md">
                                                    <div className="flex items-start justify-between">
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
                                                        <Button
                                                            onClick={() => handleRemoveStep(index)}
                                                            variant="outline"
                                                            size="sm"
                                                            className="p-1 text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
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
                        {steps.length} step{steps.length !== 1 ? 's' : ''} added
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleClose}
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!flowName.trim() || steps.length === 0}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Create Flow
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateFlowModal; 