try {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.Connect('127.0.0.1', 55432)
  'connected to postgres 55432'
  $stream = $client.GetStream()
  Start-Sleep -Milliseconds 2000
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
