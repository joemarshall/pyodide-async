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
    NUM_ITERATIONS=100000
    with timing("SYNC Nothing"):
        for x in range(NUM_ITERATIONS):
            syncDoNothing()

    with timing("ASYNC Nothing"):
        for x in range(NUM_ITERATIONS):
            await asyncDoNothing()

    c=0
    with timing("SYNC Do maths"):
        for x in range(NUM_ITERATIONS):
            syncDoMaths()

    c=0
    with timing("ASYNC Do maths"):
        for x in range(NUM_ITERATIONS):
            await asyncDoMaths()

    

from aimport_pyodide import aimport
import async_pyodide 

_loop=async_pyodide.CustomLoop()
asyncio.set_event_loop(_loop)

_loop.set_task_to_run_until_done(mainLoop())    

#asyncio.run(mainLoop())
    