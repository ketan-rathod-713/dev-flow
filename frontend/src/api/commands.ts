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
}

export const executeCommand = async (
  command: string
): Promise<CommandResult> => {
  console.log('executeCommand API called with:', command)

  const response = await fetch('http://localhost:8080/execute-command', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command })
  })

  console.log('API response status:', response.status)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const result = await response.json()
  console.log('API response data:', result)
  return result
}
