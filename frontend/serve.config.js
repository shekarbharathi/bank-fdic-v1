// Serve configuration as alternative to Vite preview
// This can be used with 'serve' package if Vite preview continues to have issues
module.exports = {
  port: process.env.PORT || 4173,
  host: '0.0.0.0',
  cors: true,
  single: true,
  etag: true,
  cache: {
    maxAge: 3600000
  }
}
