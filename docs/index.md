# Pyodide asynchronous demos

This is a quick demo site for pyodide running asynchronous python code in the browser.

This allows you to run things and watch the output over time, print to a web window etc. 

Right now, async calls are specifically supported for import statements and sleep. await, async def etc. work fine. Multiple coroutines work fine.

It has an autotranslator for basic synchronous code including sleep, which converts it to async. This might be a bit fragile, I haven't really tested.

I haven't implemented asynchronous IO at all, I guess it could easily call out to websockets stuff.

There's a basic implementation of futures, tasks etc. which can be used to implement coroutines

[Demo live coding environment](asyncio_pyodide.html)

<a onclick="async_demo()">Demo of two async coroutines</a>

<a onclick="sync_demo()">Demo of running sync code in browser with sleep</a>

<a onclick="timing_demo()">Time comparison of async vs syncified function calls</a>

<a onclick="console_demo()">Interactive console (WIP)</a>


<script>

function async_demo()
{
	localStorage.lastCode = `
import asyncio

async def mainLoop():    
    async def woo(delay):
        for c in range(3):
            await asyncio.sleep(delay)
            print("WOO")
            
    async def buzz(delay):
        for c in range(10):
            await asyncio.sleep(delay)
            print("Buzz")

    await asyncio.gather(woo(2),buzz(.3))
    print("Main loop done")
_loop=async_pyodide.CustomLoop()
asyncio.set_event_loop(_loop)

_loop.set_task_to_run_until_done(mainLoop())

`
window.location.href="asyncio_pyodide.html";
}

function sync_demo()
{
	localStorage.lastCode = `
# this is sync code. If you check the check box it will be converted to async code and
# the timing should work okay

import time
for c in range(10):
    print("woo")
    time.sleep(1.0)
print("Done")    import time
    `
window.location.href="asyncio_pyodide.html";
}

function timing_demo()
{
	localStorage.lastCode = `

c=0

import asyncio
from time import time
from contextlib import contextmanager

@contextmanager
def timing(description):
    retVals={}
    start = time()
    yield retVals
    elapsed_time = time() - start
    retVals["elapsed"]=elapsed_time
    print(f"{description}: {elapsed_time}")

def syncDoNothing():
    pass
    
async def asyncDoNothing():
    pass

def syncDoMaths():
    global c
    c=(c+1.5)*37.2
    for d in range(10):
        c+=d
    return c
    
    
async def asyncDoMaths():
    global c
    c=(c+1.5)*37.2
    for d in range(10):
        c+=d
    return c    
    
async def mainLoop():
    NUM_ITERATIONS=1000000
    with timing("SYNC Nothing"):
        for x in range(NUM_ITERATIONS):
            syncDoNothing()
    await asyncio.sleep(0)

    with timing("ASYNC Nothing"):
        for x in range(NUM_ITERATIONS):
            await asyncDoNothing()
    await asyncio.sleep(0)

    c=0
    with timing("SYNC Do maths"):
        for x in range(NUM_ITERATIONS):
            syncDoMaths()
    await asyncio.sleep(0)

    c=0
    with timing("ASYNC Do maths"):
        for x in range(NUM_ITERATIONS):
            await asyncDoMaths()

    

from aimport_pyodide import aimport
import async_pyodide 

_loop=async_pyodide.CustomLoop()
asyncio.set_event_loop(_loop)

_loop.set_task_to_run_until_done(mainLoop())
`;
window.location.href="asyncio_pyodide.html";
}

function  console_demo()
{

	localStorage.lastCode = `
import asyncio
from pyodide_console import AsyncInteractiveConsole

import async_pyodide 

async def main_loop():
    console=AsyncInteractiveConsole()
    await console.interact_async(exitmsg="Exiting console, re-run to restart")

_loop=async_pyodide.CustomLoop()

_loop.set_task_to_run_until_done(main_loop())    
`;
window.location.href="asyncio_pyodide.html";
}
</script>
