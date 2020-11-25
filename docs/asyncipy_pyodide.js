var asyncipy_src=String.raw`

from ast import *

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
    
    def _parse_call(self,name):
        allNames=name.split(".")        
        retVal=Name(id=allNames[0],ctx=Load())
        allNames=allNames[1:]
        print(dump(retVal))
        while len(allNames)>0:
            retVal=Attribute(value=retVal,attr=allNames[0],ctx=Load())
            allNames=allNames[1:]
        print(dump(retVal))
        return retVal
            
    
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
            nameNodes=self._parse_call(self.call_table[target_id])
            #print("make await",target_id,node.args,node.keywords)
            newNode=Await(Call(nameNodes,args=node.args,keywords=node.keywords))
            return newNode
        else:
            # external library call, ignore
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
    #print("WOO")
    asleep_def="""
import sys
import asyncio
from aimport_pyodide import aimport
import async_pyodide 

_loop=async_pyodide.CustomLoop()
asyncio.set_event_loop(_loop)

async def __async_main():
"""
    extraLines=len(asleep_def.split("\n"))-1
    
    all_code=asleep_def
    for line in code_str.splitlines():
        all_code+="    "+line+"\n"
    all_code+="_loop.set_task_to_run_until_done(__async_main())\n"

#    print(all_code)    

    oldTree=parse(all_code, mode='exec')        
#    print("OLDTREE")
#    print(dump(oldTree))
    defs=_FindDefs()
    defs.visit(oldTree)
    allDefs=defs.get_defs()
    # override sleep with asleep
    allDefs["sleep"]="asyncio.sleep"
    allDefs["time.sleep"]="asyncio.sleep"    
    newTree=fix_missing_locations(_MakeAsyncCalls(allDefs).visit(oldTree))
    newTree=_LineOffsetter(-extraLines).visit(newTree)
    
    
#    print("NEWTREE")
#    print(dump(newTree))
    return compile(newTree,filename="your_code.py",mode='exec')

`;

function asyncipy_pyodide_load()
{
    pyodide.runPython(`
import js           
import importlib.util
spec = importlib.util.spec_from_loader('asyncipy_pyodide', loader=None, origin="asyncipy_pyodide.py")
asyncipy_pyodide = importlib.util.module_from_spec(spec)
sys.modules['asyncipy_pyodide']=asyncipy_pyodide		
exec(js.asyncipy_src, asyncipy_pyodide.__dict__)
    `)
}



