export async function fetchFlows () {
  const res = await fetch('http://localhost:8080/flows')
  if (!res.ok) throw new Error('Failed to fetch flows')
  return res.json()
}
