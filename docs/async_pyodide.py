#this module gets imported as async_pyodide by javascript / python cunningness
from ast import *
import sys

import time

#redirect stdout and stderr
import js
sys.stdout.write=js.python_print;
sys.stderr.write=js.python_err_print


# asleep
async def asleep(seconds,result=None):
    global __jsloop
    future = __jsloop.create_future()
    if seconds == 0:
        h = future._loop.call_soon(future.set_result,result)
    else:                                           
        h = future._loop.call_later(seconds,
                                future.set_result,
                                result)
    return (await future)


# call into javascript to handle a single import 
async def _aimport(module,alias):
    global __jsloop
    future = __jsloop.create_future()
    js.python_import(module,alias,future)
    return (await future)

# import list of module,alias pairs
async def aimport(namePairs):
    for (module,alias) in namePairs:
        await _aimport(module,alias)

async def gather(*coroutines,*,return_exceptions=False):
    allTasks=[]
    for c in coroutines:
        task=__jsloop.create_task(c)    
        allTasks.append(task)
    for c in coroutines:
        await c

# task or future (future = task without a coroutine to call)
class JSAsyncTask():
    _asyncio_future_blocking = False
    
    def __init__(self,coro,*,name=None,loop=None,context=None):
#        self._asyncio_future_blocking=False
        self._loop=loop
        self.callbacks=[]
        self._result=None
        self.name=name
        self._context=context
        self._done=False
        self._coro=coro

        if self._coro:
            self._loop.call_soon(self.__step, context=self._context)

    def set_result(self,value):
        #print("Set result",value)
        self._done=True
        self._result=value
        # call done callbacks
        for c in self.callbacks:
            c(self)
        
    def __step(self, exc=None):        
        try:
            if exc is None:
                # We use the `send` method directly, because coroutines
                # don't have `__iter__` and `__next__` methods.
                result = self._coro.send(None)
                #print("SR:",result)
            else:
                result = self._coro.throw(exc)
        except StopIteration as exc:
            # if self._must_cancel:
                # # Task is cancelled right before coro stops.
                # self._must_cancel = False
                # super().cancel(msg=self._cancel_message)
            # else:
                self.set_result(exc.value)
        except (KeyboardInterrupt, SystemExit) as exc:
            self.set_exception(exc)
            raise
        except BaseException as exc:
            self.set_exception(exc)
        else:
            blocking = getattr(result, '_asyncio_future_blocking', None)
            if blocking is not None and blocking:
                result._asyncio_future_blocking = False
                result.add_done_callback(
                    self.__wakeup, context=self._context)
                    
        # except exceptions.CancelledError as exc:
            # # Save the original exception so we can chain it later.
            # self._cancelled_exc = exc
            # super().cancel()  # I.e., Future.cancel(self).
        # except (KeyboardInterrupt, SystemExit) as exc:
            # super().set_exception(exc)
            # raise
        # except BaseException as exc:

    def __wakeup(self, future):
        try:
            future.result()
        except BaseException as exc:
            # This may also be a cancellation.
            self.__step(exc)
        else:
            # Don't pass the value of `future.result()` explicitly,
            # as `Future.__iter__` and `Future.__await__` don't need it.
            # If we call `_step(value, None)` instead of `_step()`,
            # Python eval loop would use `.send(value)` method call,
            # instead of `__next__()`, which is slower for futures
            # that return non-generator iterators from their `__iter__`.
            self.__step()
        self = None  # Needed to break cycles when an exception occurs.    

    
    def add_done_callback(self,callback, *, context=None):
        self.callbacks.append(callback)
        
    def remove_done_callback(self,callback):
        self.callbacks.remove(callback)
        
    def done(self):
        return self._done
        
    def set_exception(self,e):
        raise e
        
    def __await__(self):
        if not self.done():
            self._asyncio_future_blocking = True
            yield self  # This tells Task to wait for completion.
        if not self.done():
            raise RuntimeError("await wasn't used with future")
        #print("Return result")
        return self.result()  # May raise too.        
    
    def result(self):
        return self._result
            
            
            
        

class __JSAsyncLoop():
    def __init__(self):
        self.later_calls=[]
        self.soon_calls=[]

    def run_forever(self):
        self._stopped=False
        while not self._stopped:
            self.run_once()
            
    def run_once(self):
        now_callbacks=[]
        curTime=time.time()
        if len(self.soon_calls)>0:
            (callback,args)=self.soon_calls.pop(0)
            now_callbacks.append((callback,args))
        if len(self.later_calls)>0:
            for c,(trigger_time,callback,args) in enumerate(self.later_calls):
                if trigger_time<=curTime:
                    # remove from trigger list
                    self.later_calls[c]=None
                    # run this callback
                    now_callbacks.append((callback,args))
            # remove expired calls
            new_calls=[]
            for x in self.later_calls:
                if x:
                    new_calls.append(x)
            self.later_calls=new_calls
        # schedule anything that needs done
        for cb,args in now_callbacks:
            cb(*args)
        js.python_schedule(self.get_trigger_time())
        
            
    def run_until_complete(self,f):        
        self.main=self.create_task(f)
        self.main.add_done_callback(self.onDone)
        self.run_forever()
        
    def onDone(self,f):
        if f==self.main:
            # return from main, stop now
            self.stop()
        else:
            # do nothing
            pass
            
    def stop(self):
        self._stopped=True
        
    def restart(self):
        self._stopped=False
        self.later_calls=[]
        self.now_calls=[]
            
    def create_task(self, coro, *, name=None):
        """Schedule a coroutine object.
        Return a task object.
        """
        task = JSAsyncTask(coro, loop=self, name=name)
        return task
        
    def create_future(self,*,name=None):
        future = JSAsyncTask(None, loop=self, name=name)
        return future
            
    def call_soon(self,callback,*args,context=None):
        # call this next time round the loop
        self.soon_calls.append((callback,args))
        # force javascript to schedule a run
        js.python_schedule(self.get_trigger_time())
        return 1
        
    def call_later(self,seconds,callback,*args,context=None):
        # call this later on
        self.later_calls.append((time.time()+float(seconds),callback,args))
        js.python_schedule(self.get_trigger_time())
        return 1
                
    def call_at(self,seconds,callback,*,context=None):
        self.later_calls.append((seconds,callback))
        js.python_schedule(self.get_trigger_time())
        return 1

    # how long until we need triggering next (in seconds)
    def get_trigger_time(self):
        if len(self.soon_calls)>0:
            return 0
        elif len(self.later_calls)>0:
            cur_time=time.time()
            min_time=min([max(call_time-cur_time,0) for call_time,c,a in self.later_calls])
            return min_time
        else:
            return -1
        
        
class _FindDefs(NodeVisitor):
    def __init__(self):
        self.defs={}
        
    def visit_FunctionDef(self,node):        
        #print("Found def!",type(node.name))
        self.generic_visit(node)
        self.defs[node.name]=node.name
        
    def get_defs(self):
        return self.defs


### Code to translate simple python code to be async. n.b. right now only sleep calls and imports are async in practice
# all calls to local functions are async as otherwise you can't run sleep in them
class _MakeAsyncCalls(NodeTransformer):
    def __init__(self,call_table):
        self.call_table=call_table
        self.in_main=False

    def visit_AsyncFunctionDef(self,node):
        # ignore anything that is already async except for the main 
        if node.name=='__async_main':
            self.in_main=True
            self.generic_visit(node)
            self.in_main=False
        return node

    def visit_ImportFrom(self,node):
        if not self.in_main:
            return node     
        elements=[]
        elements.append(Tuple([Constant(node.module),Constant(None)],ctx=Load()))
        # first call async code to import it into pyodide, then call the original import statement to make it be available here
        newNode=[Expr(value=Await(Call(Name('aimport',ctx=Load()),args=[List(elements,ctx=Load())],keywords=[]))),node]
        return newNode            

    def visit_Import(self,node):
        if not self.in_main:
            return node            
        elements=[]
        for c in node.names:
            thisElement=Tuple([Constant(c.name),Constant(c.asname)],ctx=Load())
            elements.append(thisElement)
        # first call async code to import it into pyodide, then call the original import statement to make it be available here
        newNode=[Expr(value=Await(Call(Name('aimport',ctx=Load()),args=[List(elements,ctx=Load())],keywords=[]))),node]
        return newNode

    def visit_FunctionDef(self,node):
        #print("Found functiondef")
        self.generic_visit(node) # make sure any calls are turned into awaits where relevant
        return AsyncFunctionDef(name=node.name,args=node.args,body=node.body,decorator_list=node.decorator_list,returns=node.returns)
    
    def visit_Call(self, node):
        target=node.func
        make_await=False
        nameParts=[]
        while type(target)==Attribute:
            nameParts=[target.attr]+nameParts
            target=target.value
        if type(target)==Name:
            nameParts=[target.id]+nameParts
        target_id=".".join(nameParts)
        simple_name=nameParts[-1]
        if target_id in self.call_table:
            make_await=True
        elif simple_name in self.call_table:
            make_await=True
        if make_await:
            #print("make await",target_id,node.args,node.keywords)
            newNode=Await(Call(Name(id=self.call_table[target_id],ctx=Load()),args=node.args,keywords=node.keywords))
            return newNode
        else:
            return Call(node.func,node.args,node.keywords)


class _LineOffsetter(NodeTransformer):
    def __init__(self,offset):
        self.offset=offset        

    def visit(self, node):
        if hasattr(node,"lineno"):
            node.lineno+=self.offset
        if hasattr(node,"endlineno"):
            node.end_lineno+=self.offset
        self.generic_visit(node)
        return node


# todo make this for multiple code modules (and maybe to guess class types from the code..)
def __compile_with_async_sleep(code_str):
    asleep_def="""
import sys
from async_pyodide import asleep,aimport

async def __async_main():
"""
    extraLines=len(asleep_def.split("\n"))-1
    
    all_code=asleep_def
    for line in code_str.splitlines():
        all_code+="    "+line+"\n"
    #print(all_code)    

    oldTree=parse(all_code, mode='exec')        
#    print("OLDTREE")
#    print(dump(oldTree))
    defs=_FindDefs()
    defs.visit(oldTree)
    allDefs=defs.get_defs()
    # override sleep with asleep
    allDefs["sleep"]="asleep"
    allDefs["time.sleep"]="asleep"    
    newTree=fix_missing_locations(_MakeAsyncCalls(allDefs).visit(oldTree))
    newTree=_LineOffsetter(-extraLines).visit(newTree)
    
    
#    print("NEWTREE")
#    print(dump(newTree))
    return compile(newTree,filename="your_code.py",mode='exec')

        
# make an async event loop        
__jsloop=__JSAsyncLoop()

def __js_run_async(code_str):
    __jsloop.stop() # stop the event loop
    # convert code to have async sleep calls
    compiled=__compile_with_async_sleep(code_str)
    # load the code main into interpreter
    import importlib.util
    spec = importlib.util.spec_from_loader('code_run', loader=None, origin="code_run.py")
    code_run = importlib.util.module_from_spec(spec)
    exec(compiled, code_run.__dict__)
    sys.modules['code_run']=code_run

    __jsloop.restart()
    # make it a task
    task=__jsloop.create_task(code_run.__async_main())
    task.add_done_callback(js.python_stop)
    # start event loop in javascript - this calls run_once repeatedly
    js.python_start()
    