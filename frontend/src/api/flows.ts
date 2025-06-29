export const fetchFlows = async () => {
  console.log('fetchFlows API called')

  const response = await fetch('http://localhost:8080/api/flows')

  console.log('Fetch flows API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Fetch flows API error:', errorText)
    throw new Error(`Failed to fetch flows: ${errorText}`)
  }

  const flows = await response.json()
  console.log('Fetch flows API response data:', flows)
  return flows
}

export interface CreateFlowRequest {
  name: string
  variables?: { [key: string]: string }
  steps: Array<{
    name: string
    command: string
    notes?: string
    skip_prompt?: boolean
    terminal: boolean
    tmux_session_name?: string
    is_tmux_terminal?: boolean
  }>
}

export interface UpdateFlowRequest {
  name: string
  description?: string
  variables?: { [key: string]: string }
}

export interface UpdateStepRequest {
  name: string
  command: string
  notes?: string
  skip_prompt?: boolean
  terminal: boolean
  tmux_session_name?: string
  is_tmux_terminal?: boolean
  order_index: number
}

export interface CreateStepRequest {
  flow_id: number
  name: string
  command: string
  notes?: string
  skip_prompt?: boolean
  terminal: boolean
  tmux_session_name?: string
  is_tmux_terminal?: boolean
  order_index: number
}

export interface UpdateVariableRequest {
  key: string
  value: string
}

export const createFlow = async (flowData: CreateFlowRequest) => {
  console.log('createFlow API called with data:', flowData)

  const response = await fetch('http://localhost:8080/api/flows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(flowData)
  })

  console.log('Create flow API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Create flow API error:', errorText)
    throw new Error(`Failed to create flow: ${errorText}`)
  }

  const result = await response.json()
  console.log('Create flow API response data:', result)
  return result
}

export const updateFlow = async (
  flowId: number,
  flowData: UpdateFlowRequest
) => {
  console.log('updateFlow API called with data:', { flowId, flowData })

  const response = await fetch(`http://localhost:8080/api/flows/${flowId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(flowData)
  })

  console.log('Update flow API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Update flow API error:', errorText)
    throw new Error(`Failed to update flow: ${errorText}`)
  }

  const result = await response.json()
  console.log('Update flow API response data:', result)
  return result
}

export const deleteFlow = async (flowId: number) => {
  console.log('deleteFlow API called with flowId:', flowId)

  const response = await fetch(`http://localhost:8080/api/flows/${flowId}`, {
    method: 'DELETE'
  })

  console.log('Delete flow API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Delete flow API error:', errorText)
    throw new Error(`Failed to delete flow: ${errorText}`)
  }

  const result = await response.json()
  console.log('Delete flow API response data:', result)
  return result
}

export const updateStep = async (
  stepId: number,
  stepData: UpdateStepRequest
) => {
  console.log('updateStep API called with data:', { stepId, stepData })

  const response = await fetch(`http://localhost:8080/api/steps/${stepId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(stepData)
  })

  console.log('Update step API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Update step API error:', errorText)
    throw new Error(`Failed to update step: ${errorText}`)
  }

  const result = await response.json()
  console.log('Update step API response data:', result)
  return result
}

export const createStep = async (stepData: CreateStepRequest) => {
  console.log('createStep API called with data:', stepData)

  const response = await fetch('http://localhost:8080/api/steps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(stepData)
  })

  console.log('Create step API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Create step API error:', errorText)
    throw new Error(`Failed to create step: ${errorText}`)
  }

  const result = await response.json()
  console.log('Create step API response data:', result)
  return result
}

export const deleteStep = async (stepId: number) => {
  console.log('deleteStep API called with stepId:', stepId)

  const response = await fetch(`http://localhost:8080/api/steps/${stepId}`, {
    method: 'DELETE'
  })

  console.log('Delete step API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Delete step API error:', errorText)
    throw new Error(`Failed to delete step: ${errorText}`)
  }

  const result = await response.json()
  console.log('Delete step API response data:', result)
  return result
}

export const updateVariable = async (
  flowId: number,
  key: string,
  variableData: UpdateVariableRequest
) => {
  console.log('updateVariable API called with data:', {
    flowId,
    key,
    variableData
  })

  const response = await fetch(
    `http://localhost:8080/api/variables/${flowId}/${key}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(variableData)
    }
  )

  console.log('Update variable API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Update variable API error:', errorText)
    throw new Error(`Failed to update variable: ${errorText}`)
  }

  const result = await response.json()
  console.log('Update variable API response data:', result)
  return result
}

export const deleteVariable = async (flowId: number, key: string) => {
  console.log('deleteVariable API called with data:', { flowId, key })

  const response = await fetch(
    `http://localhost:8080/api/variables/${flowId}/${key}`,
    {
      method: 'DELETE'
    }
  )

  console.log('Delete variable API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Delete variable API error:', errorText)
    throw new Error(`Failed to delete variable: ${errorText}`)
  }

  const result = await response.json()
  console.log('Delete variable API response data:', result)
  return result
}

export const executeStep = async (stepId: number) => {
  console.log('executeStep API called with stepId:', stepId)

  const response = await fetch('http://localhost:8080/api/execute-step', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ step_id: stepId })
  })

  console.log('Execute step API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Execute step API error:', errorText)
    throw new Error(`Failed to execute step: ${errorText}`)
  }

  const result = await response.json()
  console.log('Execute step API response data:', result)
  return result
}
