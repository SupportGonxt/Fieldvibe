Write-Host "Starting Dev Deployment..." -ForegroundColor Cyan

Write-Host "Building dev frontend..." -ForegroundColor Yellow
cd frontend
npm run build -- --mode preview

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying dev frontend to Cloudflare Pages..." -ForegroundColor Yellow
npx wrangler pages deploy dist --project-name=fieldvibe-frontend --branch=dev

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend deploy failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying dev API worker..." -ForegroundColor Yellow
cd ../workers-api
wrangler deploy --env preview

if ($LASTEXITCODE -ne 0) {
    Write-Host " API deploy failed!" -ForegroundColor Red
    exit 1
}

cd ..
Write-Host ""
Write-Host "Dev deployment complete!" -ForegroundColor Green
Write-Host "Frontend: https://dev.fieldvibe-frontend.pages.dev" -ForegroundColor Green
Write-Host "API:      https://fieldvibe-api-preview.vantax.co.za" -ForegroundColor Green