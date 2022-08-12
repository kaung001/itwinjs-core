$sourceFile = './docs/changehistory/NextVersion.md'

# If NextVersion has content do work
IF ((Get-Content -Path $sourceFile -ReadCount 1 | Measure-Object -line).Lines -gt 5) {
    # Replace placeholder header
    (Get-Content $sourceFile ) -replace 'NextVersion', "$quotelessVersion Change Notes" | Set-Content $sourceFile

    # Remove old frontmatter
    (Get-Content $sourceFile | Select-Object -Skip 3) | Set-Content $sourceFile

    # Copy NextVersion to index.md
    Copy-Item $sourceFile docs/changehistory/index.md -Force

    # Add relevant frontmatter
    "---`ndeltaDoc: true`nversion: '$quotelessVersion'`n---`n" + (Get-Content $sourceFile | Out-String) | Set-Content $sourceFile

    # Rename NextVersion
    Rename-Item -Path $sourceFile -NewName "$quotelessVersion.md"

    # Add link to leftNav.md
    (Get-Content -Path docs/changehistory/leftNav.md) -replace '### Versions', "### Versions`n- [$quotelessVersion](./$quotelessVersion.md)`n" | Set-Content -Path docs/changehistory/leftNav.md

    # Create new NextVersion.md
    New-Item $sourceFile

    # Update NextVersion.md with template
    "---`npublish: false`n---`n# NextVersion`n" + (Get-Content $sourceFile | Out-String) | Set-Content $sourceFile
}

# Change header tab in docSite.json
(Get-Content 'docs/config/docSites.json') -replace '\".*?\":\s.?\"changehistory\"', "`"v$quotelessVersion`": `"changehistory`"" | Set-Content 'docs/config/docSites.json'