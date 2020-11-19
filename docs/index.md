# Pyodide asynchronous demos

This is a quick demo site for pyodide running asynchronous python code in the browser.

This allows you to run things and watch the output over time, print to a web window etc. 

Right now, async calls are specifically supported for import statements and sleep. await, async def etc. work fine. Multiple coroutines work fine.

It has an autotranslator for basic synchronous code including sleep, which converts it to async. This might be a bit fragile, I haven't really tested.

I haven't implemented asynchronous IO at all, I guess it could easily call out to websockets stuff.

There's a basic implementation of futures, tasks etc. which can be used to implement coroutines

[Demo live coding environment](async_pyodide_demo.html)

<a onclick="async_demo()">Demo of two async coroutines</a>

<a onclick="sync_demo()">Demo of running sync code in browser with sleep</a>



<script>
function async_demo()
{
	localStorage.lastCode = `
async def woo(delay):
    while True:
        print("WOO")
        await asleep(delay)
        
async def buzz(delay):
    while True:
        print("Buzz")
        await asleep(delay)

await gather(woo(2),buzz(.3))
`
window.location.href="async_pyodide_demo.html";
}

function sync_demo()
{
	localStorage.lastCode = `
import time
while True:
    print("woo")
    time.sleep(1.0)
    `
window.location.href="async_pyodide_demo.html";
}

</script>
