import React, { useEffect, useState } from 'react';
import { fetchFlows } from '../api/flows';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import CreateFlowModal from '../components/CreateFlowModal';
import {
    Workflow,
    Clock,
    Zap,
    Loader2,
    Play,
    Eye,
    Settings,
    Terminal,
    Code
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

const FlowsPage: React.FC = () => {
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchFlows()
            .then(setFlows)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const handleCreateFlow = (newFlow: { name: string; variables: Record<string, string>; steps: Step[] }) => {
        console.log('Creating new flow:', newFlow);

        // Add the new flow to the list (in real app, this would be an API call)
        setFlows(prev => [...prev, newFlow]);

        // You could show a success toast here
        // In a real app, you'd make an API call to save the flow to the backend
    };

    const getStepTypeCounts = (steps: Step[]) => {
        const terminalSteps = steps.filter(step => step.terminal).length;
        const commandSteps = steps.filter(step => !step.terminal).length;
        return { terminalSteps, commandSteps };
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
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <Zap className="h-4 w-4 mr-2" />
                        Create New Flow
                    </Button>
                </div>

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
                                    <div className="col-span-4">Flow Name</div>
                                    <div className="col-span-2">Steps</div>
                                    <div className="col-span-2">Variables</div>
                                    <div className="col-span-2">Types</div>
                                    <div className="col-span-2 text-right">Actions</div>
                                </div>

                                {/* Table Body */}
                                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {flows.map((flow, flowIdx) => {
                                        const { terminalSteps, commandSteps } = getStepTypeCounts(flow.steps);
                                        const variableCount = Object.keys(flow.variables).length;

                                        return (
                                            <div
                                                key={flowIdx}
                                                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150"
                                            >
                                                {/* Flow Name */}
                                                <div className="col-span-4 flex items-center gap-3">
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
                                                    {commandSteps > 0 && (
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
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="col-span-2 flex items-center justify-end gap-2">
                                                    <Link to={`/flow/${encodeURIComponent(flow.name)}`}>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                        >
                                                            <Eye className="h-3 w-3" />
                                                            View
                                                        </Button>
                                                    </Link>
                                                    <Link to={`/flow/${encodeURIComponent(flow.name)}`}>
                                                        <Button
                                                            size="sm"
                                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                                        >
                                                            <Play className="h-3 w-3" />
                                                            Execute
                                                        </Button>
                                                    </Link>
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
        </div>
    );
};

export default FlowsPage; 