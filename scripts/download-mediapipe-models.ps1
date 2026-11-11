$ErrorActionPreference = 'Stop'
$modelDirectory = Join-Path $PSScriptRoot '..\public\models'
New-Item -ItemType Directory -Path $modelDirectory -Force | Out-Null

$models = @(
    @{
        Name = 'face_landmarker.task'
        Url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
    },
    @{
        Name = 'pose_landmarker_lite.task'
        Url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
    }
)

foreach ($model in $models) {
    $destination = Join-Path $modelDirectory $model.Name
    if (Test-Path $destination) {
        Write-Host "Already present: $($model.Name)"
        continue
    }
    Write-Host "Downloading $($model.Name)..."
    Invoke-WebRequest -Uri $model.Url -OutFile $destination
    Write-Host "Saved: $destination"
}

Write-Host 'MediaPipe models are ready. Restart Vite with: npm run dev'
