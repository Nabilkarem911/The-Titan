try {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.NoDelay = $true
  $client.Connect('127.0.0.1', 16379)
  'connected'
  $stream = $client.GetStream()
  $bytes = [byte[]]@(
    0x2a, 0x31, 0x0d, 0x0a,  # *1\r\n
    0x24, 0x04, 0x0d, 0x0a,  # $4\r\n
    0x50, 0x49, 0x4e, 0x47, 0x0d, 0x0a  # PING\r\n
  )
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
  Start-Sleep -Milliseconds 2000
  $buf = New-Object byte[] 256
  if ($stream.DataAvailable) {
    $read = $stream.Read($buf, 0, 256)
    'response bytes: ' + ([System.BitConverter]::ToString($buf[0..($read-1)]))
  } else {
    'no data available'
  }
} catch {
  'err: ' + $_.Exception.Message
} finally {
  $client.Close()
}
