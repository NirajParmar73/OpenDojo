export function usePlayDistribution() {
  const route = useRoute()
  const playDistribution = useState('play-distribution', () => false)
  if (import.meta.client) {
    const launchedFromPlay = route.query.source === 'play'
    if (launchedFromPlay) localStorage.setItem('opendojos-play-distribution', '1')
    playDistribution.value = launchedFromPlay || localStorage.getItem('opendojos-play-distribution') === '1'
  }
  return computed(() => playDistribution.value)
}
