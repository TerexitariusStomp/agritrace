import { buildApp } from './app.js'

const server = await buildApp()
const port = Number(process.env.PORT || 4000)

server.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`AgroTrace backend on :${port}`))
  .catch((err) => { console.error(err); process.exit(1) })
