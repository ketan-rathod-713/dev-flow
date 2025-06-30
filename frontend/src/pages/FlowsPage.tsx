import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchFlows, createFlow, deleteFlow, exportFlow, importFlow } from '../api/flows';
import type { CreateFlowRequest } from '../api/flows';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import CreateFlowModal from '../components/CreateFlowModal';
import EditFlowModal from '../components/EditFlowModal';
import {
    Workflow,
    Clock,
    Zap,
    Loader2,
    Play,
    Settings,
    Edit3,
    Trash2,
    AlertCircle,
    CheckCircle,
    Download,
    Upload,
    Plus
} from 'lucide-react';

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

const FlowsPage: React.FC = () => {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
    const [deletingFlowId, setDeletingFlowId] = useState<number | null>(null);
    const [exportingFlowId, setExportingFlowId] = useState<number | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchFlows()
            .then(setFlows)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const handleCreateFlow = async (newFlow: { name: string; variables: Record<string, string>; steps: Step[] }) => {
        console.log('Creating new flow:', newFlow);

        try {
            // Convert the flow data to match the API interface
            const flowData: CreateFlowRequest = {
                name: newFlow.name,
                variables: newFlow.variables,
                steps: newFlow.steps.map(step => ({
                    name: step.name,
                    command: step.command,
                    notes: step.notes || '',
                    skip_prompt: step.skip_prompt || false,
                    terminal: step.terminal || false,
                    tmux_session_name: step.tmux_session_name || '',
                    is_tmux_terminal: step.is_tmux_terminal || false
                }))
            };

            // Call the API to create the flow
            await createFlow(flowData);

            // Refresh the flows list
            const updatedFlows = await fetchFlows();
            setFlows(updatedFlows);

            console.log('Flow created successfully');
        } catch (error) {
            console.error('Failed to create flow:', error);
            setError('Failed to create flow. Please try again.');
        }
    };

    const handleEditFlow = (flow: Flow) => {
        setEditingFlow(flow);
        setShowEditModal(true);
    };

    const handleUpdateFlow = async (updatedFlow: Flow) => {
        try {
            // Refresh the flows list
            const updatedFlows = await fetchFlows();
            setFlows(updatedFlows);

            // Update the editing flow state with the latest data
            const refreshedFlow = updatedFlows.find((f: Flow) => f.id === updatedFlow.id);
            if (refreshedFlow) {
                setEditingFlow(refreshedFlow);
            }

            console.log('Flow updated successfully');
        } catch (error) {
            console.error('Failed to refresh flows after update:', error);
            setError('Failed to refresh flows. Please reload the page.');
        }
    };

    const handleDeleteFlow = async (flowId: number, flowName: string) => {
        if (!confirm(`Are you sure you want to delete "${flowName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            setDeletingFlowId(flowId);
            await deleteFlow(flowId);

            // Remove the flow from the local state
            setFlows(prev => prev.filter(flow => flow.id !== flowId));
            console.log('Flow deleted successfully');
        } catch (error) {
            console.error('Failed to delete flow:', error);
            setError('Failed to delete flow. Please try again.');
        } finally {
            setDeletingFlowId(null);
        }
    };

    const handleExportFlow = async (flowId: number, flowName: string) => {
        try {
            setExportingFlowId(flowId);
            const blob = await exportFlow(flowId);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${flowName}-flow-export.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            console.log(`Flow ${flowName} exported successfully`);
        } catch (error) {
            console.error('Failed to export flow:', error);
            setError(error instanceof Error ? error.message : 'Failed to export flow');
        } finally {
            setExportingFlowId(null);
        }
    };

    const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'application/json') {
            setImportFile(file);
            setImportSuccess(null);
        } else {
            setError('Please select a valid JSON file');
        }
    };

    const handleImportFlow = async () => {
        if (!importFile) return;

        try {
            setImporting(true);
            setError(null);

            const fileContent = await importFile.text();
            const flowData = JSON.parse(fileContent);

            const result = await importFlow(flowData);
            setImportSuccess(result.message);

            // Refresh flows list
            await fetchFlows();

            // Reset import state
            setImportFile(null);

            console.log('Flow imported successfully:', result);
        } catch (error) {
            console.error('Failed to import flow:', error);
            setError(error instanceof Error ? error.message : 'Failed to import flow');
        } finally {
            setImporting(false);
        }
    };

    // const getStepTypeCounts = (steps: Step[]) => {
    //     const terminalSteps = steps.filter(step => step.terminal).length;
    //     const commandSteps = steps.filter(step => !step.terminal).length;
    //         return { terminalSteps, commandSteps };
    //     };

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
                        <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-600 dark:text-slate-300 mb-4">{error}</p>
                        <Button
                            onClick={() => {
                                setError(null);
                                setLoading(true);
                                fetchFlows()
                                    .then(setFlows)
                                    .catch((e) => setError(e.message))
                                    .finally(() => setLoading(false));
                            }}
                            className="w-full"
                        >
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
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
                    <div className="flex items-center gap-3">
                        {/* Import Flow */}
                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImportFile}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                id="import-file"
                            />
                            <Button
                                variant="outline"
                                className="flex items-center gap-2"
                                disabled={importing}
                            >
                                {importing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                Import Flow
                            </Button>
                        </div>

                        {/* Import Flow Button (when file selected) */}
                        {importFile && (
                            <Button
                                onClick={handleImportFlow}
                                disabled={importing}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Import {importFile.name}
                                    </>
                                )}
                            </Button>
                        )}

                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New Flow
                        </Button>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {importSuccess && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-800">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">{importSuccess}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800">
                            <AlertCircle className="h-5 w-5" />
                            <span className="font-medium">{error}</span>
                            <Button
                                onClick={() => setError(null)}
                                variant="ghost"
                                size="sm"
                                className="ml-auto text-red-600 hover:text-red-800"
                            >
                                ×
                            </Button>
                        </div>
                    </div>
                )}

                {/* Flows Table */}
                {flows.length > 0 ? (
                    <Card className="overflow-hidden shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
                            <CardTitle className="text-xl text-slate-900 dark:text-white">
                                Workflows ({flows.length})
                            </CardTitle>
                            <CardDescription>
                                Select a workflow to view details and execute steps
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300">
                                    <div className="col-span-3">Flow Name</div>
                                    <div className="col-span-2">Steps</div>
                                    <div className="col-span-2">Variables</div>
                                    <div className="col-span-2"></div>
                                    <div className="col-span-3 text-right">Actions</div>
                                </div>

                                {/* Table Body */}
                                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {flows.map((flow, flowIdx) => {
                                        // const { terminalSteps, commandSteps } = getStepTypeCounts(flow.steps);
                                        const variableCount = Object.keys(flow.variables).length;
                                        const isDeleting = deletingFlowId === flow.id;

                                        return (
                                            <div
                                                key={flowIdx}
                                                className={`grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 ${isDeleting ? 'opacity-50' : ''}`}
                                            >
                                                {/* Flow Name */}
                                                <div className="col-span-3 flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                        <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-900 dark:text-white">
                                                            {flow.name}
                                                        </h3>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                                            Workflow
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Steps Count */}
                                                <div className="col-span-2 flex items-center">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-slate-500" />
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {flow.steps.length}
                                                        </span>
                                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                                            steps
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Variables Count */}
                                                <div className="col-span-2 flex items-center">
                                                    <div className="flex items-center gap-2">
                                                        <Settings className="h-4 w-4 text-slate-500" />
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {variableCount}
                                                        </span>
                                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                                            vars
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Step Types */}
                                                <div className="col-span-2 flex items-center gap-2">
                                                    {/* {commandSteps > 0 && (
                                                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                            <Code className="h-3 w-3" />
                                                            {commandSteps}
                                                        </Badge>
                                                    )}
                                                    {terminalSteps > 0 && (
                                                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                            <Terminal className="h-3 w-3" />
                                                            {terminalSteps}
                                                        </Badge>
                                                    )} */}
                                                </div>

                                                {/* Actions */}
                                                <div className="col-span-3 flex items-center justify-end gap-2">
                                                    {/* <Link to={`/flow/${encodeURIComponent(flow.name)}`}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                            disabled={isDeleting}
                                                        >
                                                            <Eye className="h-3 w-3" />
                                                            View
                                                        </Button>
                                                    </Link> */}
                                                    <Button
                                                        onClick={() => handleEditFlow(flow)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                        disabled={isDeleting}
                                                    >
                                                        <Edit3 className="h-3 w-3" />
                                                        Edit
                                                    </Button>
                                                    <Link to={`/flow/${encodeURIComponent(flow.name)}`}>
                                                        <Button
                                                            size="sm"
                                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                                            disabled={isDeleting}
                                                        >
                                                            <Play className="h-3 w-3" />
                                                            Execute
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        onClick={() => flow.id && handleExportFlow(flow.id, flow.name)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-2 text-slate-600 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/30"
                                                        disabled={exportingFlowId === flow.id || isDeleting || !flow.id}
                                                    >
                                                        {exportingFlowId === flow.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Download className="h-3 w-3" />
                                                        )}
                                                        {exportingFlowId === flow.id ? 'Exporting...' : 'Export'}
                                                    </Button>
                                                    <Button
                                                        onClick={() => flow.id && handleDeleteFlow(flow.id, flow.name)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                        disabled={isDeleting || !flow.id}
                                                    >
                                                        {isDeleting ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-3 w-3" />
                                                        )}
                                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="max-w-2xl mx-auto text-center border-dashed border-2 border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                        <CardContent className="p-12">
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                                    <Workflow className="h-12 w-12 text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                        No workflows found
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 mb-6">
                                        Create your first workflow to get started with automated development tasks.
                                    </p>
                                    <Button
                                        onClick={() => setShowCreateModal(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                                    >
                                        <Zap className="h-4 w-4 mr-2" />
                                        Create Your First Flow
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Create Flow Modal */}
            <CreateFlowModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateFlow}
            />

            {/* Edit Flow Modal */}
            <EditFlowModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingFlow(null);
                }}
                onSubmit={handleUpdateFlow}
                flow={editingFlow}
            />
        </div>
    );
};

export default FlowsPage; 