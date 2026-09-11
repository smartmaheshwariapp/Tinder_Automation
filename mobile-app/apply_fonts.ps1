$f = 'C:\Users\HP\Downloads\TinderAutomation\Tinder_Automation\mobile-app\src\screens\OnboardingScreen.js'
$l = [System.IO.File]::ReadAllLines($f)

function Rep([int]$start, [string]$old, [string]$new) {
  for ($i = $start; $i -lt ($start + 12); $i++) {
    if ($l[$i] -match [regex]::Escape($old)) {
      $l[$i] = $l[$i].Replace($old, $new)
      return
    }
  }
}

Rep 3578 "fontWeight: '900'" "fontFamily: 'PlayfairDisplay_700Bold'"
Rep 3674 "fontWeight: '900'" "fontFamily: 'PlayfairDisplay_700Bold'"
Rep 3681 "fontWeight: '500'" "fontFamily: 'Nunito_500Medium'"
Rep 4190 "fontWeight: '900'" "fontFamily: 'PlayfairDisplay_700Bold'"
Rep 4203 "fontWeight: '500'" "fontFamily: 'Nunito_500Medium'"
Rep 4854 "fontWeight: '900'" "fontFamily: 'PlayfairDisplay_700Bold'"
Rep 4862 "fontWeight: '500'" "fontFamily: 'Nunito_500Medium'"
Rep 5294 "fontWeight: '700'" "fontFamily: 'Nunito_800ExtraBold'"

[System.IO.File]::WriteAllLines($f, $l)
Write-Output 'Fonts applied to OnboardingScreen'
