import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

const distDir = resolve('dist')
const port = Number(process.env.PORT || 8080)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const path = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = join(distDir, decodeURIComponent(path))

  const send = async (pathname) => {
    try {
      const data = await readFile(pathname)
      res.statusCode = 200
      res.setHeader('Content-Type', types[extname(pathname)] || 'application/octet-stream')
      res.end(data)
    } catch {
      const fallback = join(distDir, 'index.html')
      const data = await readFile(fallback)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(data)
    }
  }

  if (path.includes('..')) {
    res.statusCode = 400
    res.end('Bad Request')
    return
  }

  await send(filePath)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`VOLLEY3D Mobile listening on http://0.0.0.0:${port}`)
})
