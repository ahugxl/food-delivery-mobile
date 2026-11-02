param([ValidateSet('start','build','test')][string]$Action='start')
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$mavenRoot=Join-Path $projectRoot '.tools/apache-maven-3.9.11'
if(-not(Test-Path -LiteralPath (Join-Path $mavenRoot 'bin/mvn.cmd'))){
  $toolRoot=Join-Path $projectRoot '.tools'
  [IO.Directory]::CreateDirectory($toolRoot)|Out-Null
  $archive=Join-Path $toolRoot 'apache-maven-3.9.11-bin.zip'
  $url='https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip'
  Invoke-WebRequest $url -OutFile $archive
  $expected=(Invoke-WebRequest ($url+'.sha512')).Content.Trim()
  if((Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash -ine $expected){throw 'Maven checksum mismatch'}
  Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot
}
if(Test-Path -LiteralPath 'C:/Program Files/Android/Android Studio/jbr/bin/java.exe'){
  $env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
}
Push-Location $PSScriptRoot
try {
  $maven=Join-Path $mavenRoot 'bin/mvn.cmd'
  switch($Action){
    'test' { & $maven test }
    'build' { & $maven '-DskipTests' package }
    'start' { & $maven spring-boot:run }
  }
  if($LASTEXITCODE -ne 0){throw "Maven failed ($LASTEXITCODE)"}
} finally { Pop-Location }
