var async_pyodide_src=
`
import asyncio,selectors,sys,js

async def woo():
    print("woo")
    await asyncio.sleep(1)
    print("Boo")
    
async def yay():
    for c in range(5):
        print("Yay")
        await asyncio.sleep(0.1)
        print("YAY")

class JSSelector(selectors.BaseSelector):
    def __init__(self):
        super().__init__()
        self.keyMap={}
        self.delay=-1
        
    def register(self,fileobj, events, data=None):
        self.keyMap[fileobj]=SelectorKey(fileobj=fileobj,events=events,data=data)
        
    def unregister(self,fileobj):
        self.keymap.remove(fileobj)
        
    def modify(self,fileobj, events, data=None):
        self.register(fileobj,events,data)
        
    def select(self,timeout=None):
        if timeout==None:
            self.delay=-1
        else:
            self.delay=timeout
        return []
        
    def get_map(self):
        return self.keymap
    
    def get_delay(self):
        return self.delay

class CustomLoop(asyncio.BaseEventLoop):
    def __init__(self):
        self._selector=JSSelector()
        super().__init__()
        asyncio.set_event_loop(self)
        
    def get_delay(self):
        return self._selector.get_delay()
        
    def _process_events(self,events):
        pass
    
    def start(self):
        js.eval("""
            var pyodide_async_loop_id=-1;
            function pyodide_async_tick()
            {
                //console.log("tick:"+pyodide_async_timeout)
        	    loop=pyodide.globals.asyncio.get_event_loop()
        	    loop._run_once();
        	    pyodide_async_timeout=loop.get_delay()
                if(pyodide_async_loop_id!=-1)
	            {
        		    window.clearInterval(pyodide_async_loop_id);
        		}
        		if(pyodide_async_timeout>=0)
        		{
		            pyodide_async_loop_id=window.setTimeout(pyodide_async_tick,pyodide_async_timeout*1000)
    	        }
            }
        """)
        js.pyodide_async_tick()
    
    def set_task_to_run_until_done(self,mainTask):
        task=self.create_task(self.stop_when_task_done(mainTask))
        self.start()
    
    async def stop_when_task_done(self,future):
        try:
            future=asyncio.tasks.ensure_future(future)
            await future
        except:
            if future.done() and not future.cancelled():
                # The coroutine raised a BaseException. Consume the exception
                # to not log a warning, the caller doesn't have access to the
                # local task.
                future.exception()
            raise
        if not future.done():
            raise RuntimeError('Event loop stopped before Future completed.')
        return future.result()

`;

function async_pyodide_load()
{
	pyodide.runPython(`
	import js			
	import importlib.util
	spec = importlib.util.spec_from_loader('async_pyodide', loader=None, origin="async_pyodide.py")
	async_pyodide = importlib.util.module_from_spec(spec)
	sys.modules['async_pyodide']=async_pyodide		
	exec(js.async_pyodide_src, async_pyodide.__dict__)
	`)
}

