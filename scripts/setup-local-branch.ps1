# Setup script for local branch merge driver
# Run this after checking out the 'local' branch to configure the merge driver locally.

# Ensure we're in repo root
Set-Location -Path $PSScriptRoot\..\

# Configure the 'ours' merge driver locally to always keep our version
git config --local merge.ours.driver true

Write-Host "Configured merge.ours.driver true in local git config"
Write-Host "Remember to commit .gitattributes on branch 'local' with your local-only files changed."