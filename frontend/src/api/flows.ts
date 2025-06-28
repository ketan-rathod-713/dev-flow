export const fetchFlows = async () => {
  console.log('fetchFlows API called')

  const response = await fetch('http://localhost:8080/flows')
  console.log('Flows API response status:', response.status)

  if (!response.ok) {
    throw new Error('Failed to fetch flows')
  }

  const result = await response.json()
  console.log('Flows API response data:', result)
  return result
}
