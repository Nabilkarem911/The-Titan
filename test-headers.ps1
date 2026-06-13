try {
  $h = Invoke-WebRequest -Method GET -Uri "http://127.0.0.1:3100/" -UseBasicParsing -Headers @{Origin="http://localhost:3100"} -ErrorAction Stop
  "code: $($h.StatusCode)"
  $wh = $h.Headers
  foreach ($k in @("Content-Security-Policy","X-Frame-Options","X-Content-Type-Options","Referrer-Policy","Cross-Origin-Opener-Policy","Cross-Origin-Resource-Policy","Cross-Origin-Embedder-Policy","X-DNS-Prefetch-Control","X-Download-Options","X-Permitted-Cross-Domain-Policies")) {
    $v = $wh[$k]
    if ($v) { "  ${k}: $v" } else { "  MISSING: $k" }
  }
} catch [System.Net.WebException] {
  $r = $_.Exception.Response
  "code: $([int]$r.StatusCode)"
  $wh = $r.Headers
  foreach ($k in @("Content-Security-Policy","X-Frame-Options","X-Content-Type-Options","Referrer-Policy","Cross-Origin-Opener-Policy","Cross-Origin-Resource-Policy","Cross-Origin-Embedder-Policy","X-DNS-Prefetch-Control","X-Download-Options","X-Permitted-Cross-Domain-Policies")) {
    $v = $wh[$k]
    if ($v) { "  ${k}: $v" } else { "  MISSING: $k" }
  }
}
