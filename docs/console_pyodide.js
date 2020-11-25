var pyodide_console_area=undefined;
var pyodide_read_promise = undefined;

var pyodide_console_src=String.raw`
import code 
import js
import sys
import asyncio

class AsyncInteractiveConsole(code.InteractiveConsole):
    async def interact_async(self,banner=None,exitmsg=None):
        """Closely emulate the interactive Python console.
        The optional banner argument specifies the banner to print
        before the first interaction; by default it prints a banner
        similar to the one printed by the real Python interpreter,
        followed by the current class name in parentheses (so as not
        to confuse this with the real interpreter -- since it's so
        close!).
        The optional exitmsg argument specifies the exit message
        printed when exiting. Pass the empty string to suppress
        printing an exit message. If exitmsg is not given or None,
        a default message is printed.
        """
        try:
            sys.ps1
        except AttributeError:
            sys.ps1 = ">>> "
        try:
            sys.ps2
        except AttributeError:
            sys.ps2 = "... "
        cprt = 'Type "help", "copyright", "credits" or "license" for more information.'
        if banner is None:
            self.write("Python %s on %s\n%s\n(%s)\n" %
                       (sys.version, sys.platform, cprt,
                        self.__class__.__name__))
        elif banner:
            self.write("%s\n" % str(banner))
        more = 0
        while 1:
            try:
                if more:
                    prompt = sys.ps2
                else:
                    prompt = sys.ps1
                try:
                    line = await self.async_raw_input(prompt)
                except EOFError:
                    self.write("\n")
                    break
                else:
                    more = self.push(line)
            except KeyboardInterrupt:
                self.write("\nKeyboardInterrupt\n")
                self.resetbuffer()
                more = 0
        if exitmsg is None:
            self.write('now exiting %s...\n' % self.__class__.__name__)
        elif exitmsg != '':
            self.write('%s\n' % exitmsg)        
    
    async def async_raw_input(self,prompt):
        print(prompt+"\n")
        return await self.async_readline()
        
    async def async_readline(self):
        _loop=asyncio.get_running_loop()
        future = _loop.create_future()
        fullString=js.pyodide_wait_for_console_line(future.set_result)
        await future
        retVal=future.result()
        return retVal



`;

// TODO: make this send messages so it works with web worker
async function pyodide_wait_for_console_line(callback)
{
    fullLine=""
	if (pyodide_console_area)
	{
        while(true)
        {
            console.log("beforekey")
            const key=await pyodide_read_promise();
            console.log("gotkey"+":"+String.fromCharCode(key.charCode)+":"+key.code)
            fullLine+=String.fromCharCode(key.charCode);
            if (key.charCode==13)
            {
                console.log("Got line:"+fullLine)
                console.log(callback)
                // send line back to callback
                callback(fullLine);
                return
            }
        }
	}
}

function console_pyodide_load(input_area)
{
	pyodide_console_area=input_area
    pyodide_read_promise = () => new Promise(resolve => input_area.addEventListener('keypress', resolve, { once: true }));
    
    pyodide.runPython(`
import js           
import importlib.util
spec = importlib.util.spec_from_loader('pyodide_console', loader=None, origin="pyodide_console.py")
pyodide_console = importlib.util.module_from_spec(spec)
sys.modules['pyodide_console']=pyodide_console		
exec(js.pyodide_console_src, pyodide_console.__dict__)
    `)
    
    
}
