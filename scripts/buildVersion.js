export default function buildVersion() {
  const buildId = Date.now().toString(36)
  return {
    name: 'build-version',
    config: () => ({ define: { __BUILD_ID__: JSON.stringify(buildId) } }),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId }) })
    }
  }
}
