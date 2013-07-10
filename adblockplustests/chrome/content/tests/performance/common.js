function runTests(testFunc, cleanupFunc, finalizeFunc)
{
  const minRuns = 15;
  const maxRuns = 400;
  const targetConfidenceInterval = 0.04;

  let currentRun = 0;
  let results = [];
  function runNextTest()
  {
    currentRun++;

    if (currentRun > minRuns)
    {
      let [avg, interval] = getConfidenceInterval(results);

      if (currentRun > maxRuns || interval <= avg * targetConfidenceInterval)
      {
        let text = "Average time: " + avg.toFixed(1) + " ms +/- " + interval.toFixed(1) + " ms (95% confidence)\n\n";
        for (let i = 0; i < results.length; i++)
          text += "Run no. " + (i + 1) + ": " + results[i] + " ms\n";

        document.getElementById("result").textContent = text;
        if (typeof finalizeFunc == "function")
          finalizeFunc();
        return;
      }
    }

    // Make sure garbage collection doesn't run during the test
    Components.utils.forceGC();

    let startTime = Date.now();
    testFunc();
    let endTime = Date.now();
    results.push(endTime - startTime);

    if (cleanupFunc)
      cleanupFunc();

    setTimeout(runNextTest, 0);
  }

  setTimeout(runNextTest, 0);
}

function getConfidenceInterval(results)
{
  let sum = 0;
  let sqrsum = 0;

  for each (let result in results)
  {
    sum += result;
    sqrsum += result * result;
  }

  let avg = sum / results.length;
  let stddev = Math.sqrt((sqrsum - 2 * sum * avg + avg * avg * results.length) / results.length);
  let confidence = 1.96 * stddev; // 95% confidence, assuming Gaussian distribution
  return [avg, stddev];
}
