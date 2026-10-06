$ErrorActionPreference = "Stop"
$BASE = "http://localhost:8787/api"
$results = @()

function Run-Case($num, $name, $method, $url, $body, $expect) {
  $tmp = New-TemporaryFile
  if ($null -ne $body) {
    $bodyFile = New-TemporaryFile
    [System.IO.File]::WriteAllText($bodyFile.FullName, $body)
    $code = curl.exe -s -X $method -H "Content-Type: application/json" --data-binary "@$($bodyFile.FullName)" -o $tmp.FullName -w "%{http_code}" $url
    Remove-Item $bodyFile.FullName -Force
  } else {
    $code = curl.exe -s -X $method -o $tmp.FullName -w "%{http_code}" $url
  }
  $resp = Get-Content $tmp.FullName -Raw
  Remove-Item $tmp.FullName -Force
  if ([string]::IsNullOrWhiteSpace($resp)) { $resp = "(empty body)" }
  $pass = ($code -eq $expect)
  $script:results += [pscustomobject]@{
    num = $num; name = $name; method = $method; url = $url.Replace($BASE, "{BASE}");
    body = $body; expected = $expect; actual = "$code"; pass = $pass; response = $resp.Trim()
  }
  Write-Host ("[{0}] {1} {2} -> {3} (expect {4}) {5}" -f $num, $method, $name, $code, $expect, $(if ($pass) {"PASS"} else {"FAIL"}))
}

# 1. List equipment
Run-Case 1 "List equipment" "GET" "$BASE/equipment" $null "200"

# 2. Create booking (valid)
$b1 = '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
Run-Case 2 "Create booking (valid)" "POST" "$BASE/bookings" $b1 "201"
$createdId = (($results[-1].response | ConvertFrom-Json).id)
Write-Host "    created id = $createdId"

# 3. Overlapping booking -> 409
$b2 = '{"equipmentId":"eq-1","borrowerName":"prung Pendee","startAt":"2026-10-20T10:00:00.000Z","endAt":"2026-10-20T12:00:00.000Z","purpose":"Video shoot"}'
Run-Case 3 "Create overlapping booking" "POST" "$BASE/bookings" $b2 "409"

# 4. startAt >= endAt -> 400
$b3 = '{"equipmentId":"eq-1","borrowerName":"Bad Time","startAt":"2026-10-20T11:00:00.000Z","endAt":"2026-10-20T09:00:00.000Z","purpose":"Invalid range"}'
Run-Case 4 "Create with end before start" "POST" "$BASE/bookings" $b3 "400"

# 5. Unknown equipment -> 400
$b4 = '{"equipmentId":"eq-999","borrowerName":"No Gear","startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T10:00:00.000Z","purpose":"Ghost booking"}'
Run-Case 5 "Create with unknown equipmentId" "POST" "$BASE/bookings" $b4 "400"

# 6. Get missing booking -> 404
Run-Case 6 "Get missing booking" "GET" "$BASE/bookings/no-such-id" $null "404"

# 7a. Update own booking (self-exclusion) -> 200
$pu = "{`"purpose`":`"Class presentation (updated)`",`"endAt`":`"2026-10-20T11:30:00.000Z`"}"
Run-Case 7 "Update own booking (extend end)" "PATCH" "$BASE/bookings/$createdId" $pu "200"

# 7b. Update that would overlap -> 409
$b5 = '{"equipmentId":"eq-1","borrowerName":"prung Pendee","startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T11:00:00.000Z","purpose":"Other day"}'
$tmpB5 = New-TemporaryFile
[System.IO.File]::WriteAllText($tmpB5.FullName, $b5)
$c = curl.exe -s -X POST -H "Content-Type: application/json" --data-binary "@$($tmpB5.FullName)" -o NUL -w "%{http_code}" "$BASE/bookings"
Remove-Item $tmpB5.FullName -Force
# create a second booking on eq-1 next day (should be 201)
Write-Host "    second booking (other day) create -> $c"
# now PATCH the first booking into the second's window -> 409
# first get second id
$second = (curl.exe -s "$BASE/bookings" | ConvertFrom-Json) | Where-Object { $_.purpose -eq "Other day" }
$pu2 = "{`"startAt`":`"$($second.startAt)`",`"endAt`":`"$($second.endAt)`"}"
Run-Case 7 "Update booking into conflicting window" "PATCH" "$BASE/bookings/$createdId" $pu2 "409"

# 8. Delete -> 204, then GET -> 404
Run-Case 8 "Delete booking" "DELETE" "$BASE/bookings/$createdId" $null "204"
Run-Case 8 "Get after delete" "GET" "$BASE/bookings/$createdId" $null "404"

# Bonus: back-to-back booking (boundary touch) -> 201
$b6 = '{"equipmentId":"eq-2","borrowerName":"Boundary Test","startAt":"2026-10-22T09:00:00.000Z","endAt":"2026-10-22T09:00:00.000Z","purpose":"zero length"}'
Run-Case 9 "Create with zero-length window" "POST" "$BASE/bookings" $b6 "400"

$pass = ($results | Where-Object { -not $_.pass }).Count -eq 0
Write-Host ""
Write-Host ("TOTAL: {0}/{1} passed" -f ($results | Where-Object pass).Count, $results.Count)
$results | ConvertTo-Json -Depth 4 | Set-Content "test_results.json" -Encoding utf8
exit $(if ($pass) { 0 } else { 1 })
