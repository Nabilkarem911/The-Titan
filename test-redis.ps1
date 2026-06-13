try {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.Connect('127.0.0.1', 6379)
  'connected'
  $stream = $client.GetStream()
  $bytes = [System.Text.Encoding]::ASCII.GetBytes("PING`r`n")
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
  Start-Sleep -Milliseconds 1000
  if ($stream.DataAvailable) {
    $reader = New-Object System.IO.StreamReader($stream)
    'response: ' + $reader.ReadLine()
  } else {
    'no data available'
  }
} catch {
  'err: ' + $_.Exception.Message
} finally {
  $client.Close()
}
