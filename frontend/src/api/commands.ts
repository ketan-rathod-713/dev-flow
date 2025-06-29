export interface CommandResult {
  command: string
  exit_code: number
  stdout: string
  stderr: string
  duration: number
  success: boolean
  executed_at: string
}

export interface CommandRequest {
  command: string
  variables?: Record<string, string>
}

export const executeCommand = async (
  command: string,
  variables?: Record<string, string>
): Promise<CommandResult> => {
  console.log('executeCommand called with:', { command, variables })

  const requestBody: CommandRequest = {
    command,
    variables: variables || {}
  }

  const response = await fetch('http://localhost:8080/execute-command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  console.log('API response status:', response.status)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  console.log('API response data:', data)
  return data
}
