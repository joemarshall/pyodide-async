var aimport_src=`

# call into javascript to handle a single import 
import asyncio
import js
async def _aimport(module,alias):
    future = asyncio.get_event_loop().create_future()
    js.pyodide_async_import(module,alias,future)
    return (await future)
	
# import list of module,alias pairs
async def aimport(namePairs):
    for (module,alias) in namePairs:
        await _aimport(module,alias)
	
`;



function pyodide_async_import(module,alias,future)
{
	console.log("Import ",module)
	if(alias)
	{
		pyodide.runPythonAsync("import " +module +" as "+alias).then(value=>{future.set_result(1)},reason=>{python_err_print(reason);});
	}else
	{
		pyodide.runPythonAsync("import " +module).then(value=>{future.set_result(1)},reason=>{python_err_print(reason);});
	}	
}

function aimport_pyodide_load()
{
	pyodide.runPython(`
	import js			
	import importlib.util
	spec = importlib.util.spec_from_loader('aimport_pyodide', loader=None, origin="aimport_pyodide.py")
	aimport_pyodide = importlib.util.module_from_spec(spec)
	sys.modules['aimport_pyodide']=aimport_pyodide		
	exec(js.aimport_src, aimport_pyodide.__dict__)
	`)
}
