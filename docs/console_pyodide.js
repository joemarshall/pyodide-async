var pyodide_console_area = undefined;
var pyodide_read_promise = undefined;
var pyodide_paste_promise= undefined;
var pyodide_read_arrows_promise=undefined;
var pyodide_console_src=String.raw`
import code 
import js
import sys
import asyncio

import rlcompleter

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
        self.completer=rlcompleter.Completer()
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
            except SystemExit:
                break
        if exitmsg is None:
            self.write('now exiting %s...\n' % self.__class__.__name__)
        elif exitmsg != '':
            self.write('%s\n' % exitmsg)
    
    async def async_raw_input(self,prompt_text):
        return await self.async_readline(prompt_text)
        
    async def async_readline(self,prompt_text):
        _loop=asyncio.get_running_loop()
        future = _loop.create_future()
        fullString=js.pyodide_wait_for_console_line(prompt_text,future.set_result,self.completer)
        await future
        retVal=future.result()
        return retVal



`;

let pyodide_history_lines=[]
let pyodide_history_line=0;

// keep line history
// support ctrl+v / paste
async function pyodide_wait_for_console_line(prompt_text,callback,completer)
{
    fullLine=""
	if (pyodide_console_area)
	{
        //console.log("MAKE TRUE")
        pyodide_console_area.setAttribute('contenteditable',true);
        let promptSpan=document.createElement("span");
        promptSpan.style="color:#00f;";
        promptSpan.textContent=prompt_text;
        pyodide_print_area.appendChild(promptSpan)
        pyodide_print_area.scrollTop = pyodide_print_area.scrollHeight;
        // move cursor to prompt line in div
        let selection=window.getSelection();
        let  eventline_pos=0;
        let  eventline_offset=prompt_text.length;
        selection.removeAllRanges();
        selection.collapse(promptSpan.firstChild,eventline_offset);

        let completionNumber=0;
        let completionBase="";

        let mouseDown=false;
        while(true)
        {
  //          console.log("beforekey")
            const evt=await Promise.any([pyodide_read_promise(),pyodide_selectionchange_promise(),pyodide_paste_promise(),pyodide_mousedown_promise(),pyodide_mouseup_promise(),pyodide_read_arrows_promise()])
//            const evt=await Promise.any([pyodide_read_promise(),pyodide_paste_promise()]);
  //          console.log(evt);
            if(evt.type=='keydown')
            {
                console.log(evt.code);
                if(evt.key=='Tab')
                {
                    if(completionNumber==0)
                    {
                        spanOffset=selection.focusOffset;
                        eventline_pos=spanOffset-eventline_offset;

                        fullLine=promptSpan.innerText;
                        fullLine=fullLine.substring(prompt_text.length)
                        
                        completionBase=fullLine.substring(0,eventline_pos)
                    }
                        
                    // tab completion
                    completion=completer.complete(completionBase,completionNumber)
                    if (completion==undefined)
                    {
                        completionNumber=0;
                        promptSpan.innerText=prompt_text+completionBase;
                    }else
                    {
                        promptSpan.innerText=prompt_text+completion;
                        completionNumber+=1;
                    }
                    selection.collapse(promptSpan.firstChild,promptSpan.innerText.length);
                    console.log(completion+":"+completionNumber)
                    
                    // unless it is in blank space offset
                    evt.preventDefault();
                }
                if(evt.code=='ArrowLeft')
                {
                    // reset tab completion
                    completionNumber=0;
                }
                else if(evt.code=='ArrowRight')
                {
                    // reset tab completion
                    completionNumber=0;
                }
                else if(evt.key=='Home')
                {
                    if(evt.getModifierState("Shift"))
                    {
                        let r=new Range();
                        spanOffset=selection.focusOffset;
                        eventline_pos=spanOffset-eventline_offset;                        
                        r.setEnd(promptSpan.firstChild,eventline_pos+eventline_offset);
                        r.setStart(promptSpan.firstChild,prompt_text.length);
                        selection.removeAllRanges();
                        selection.addRange(r);
                        console.log("HM");
                    }else
                    {
                        selection.collapse(promptSpan.firstChild,prompt_text.length);
                    }
                    evt.preventDefault();
                }
                else if(evt.key=='End')
                {
                    if(evt.getModifierState("Shift"))
                    {
                        spanOffset=selection.focusOffset;
                        eventline_pos=spanOffset-eventline_offset;                        
                        let r=new Range();
                        r.setStart(promptSpan.firstChild,eventline_pos+eventline_offset);
                        r.setStart(promptSpan.firstChild,promptSpan.innerText.length);
                        selection.removeAllRanges();
                        selection.addRange(r);
                    }else
                    {
                        selection.collapse(promptSpan.firstChild,promptSpan.innerText.length);
                        evt.preventDefault();
                        console.log("ED");
                    }
                }
                else if(evt.key=='ArrowDown')
                {
                    // load next in history if it exists
                    if(pyodide_history_line<pyodide_history_lines.length-1)
                    {
                        // move to next line
                        pyodide_history_line+=1;
                        promptSpan.innerText=prompt_text+pyodide_history_lines[pyodide_history_line];
                        selection.collapse(promptSpan.firstChild,promptSpan.innerText.length);
                    }
                    evt.preventDefault();
                }
                else if(evt.code=='ArrowUp')
                {
                    // load previous history line
                    if(pyodide_history_line>0)
                    {
                        pyodide_history_line-=1;
                        promptSpan.innerText=prompt_text+pyodide_history_lines[pyodide_history_line];
                        selection.collapse(promptSpan.firstChild,promptSpan.innerText.length);
                    }
                    evt.preventDefault();
                }
                else if(evt.key=='Backspace')
                {
                    spanOffset=selection.focusOffset;
                    eventline_pos=spanOffset-eventline_offset;
                    if(eventline_pos<=0)
                    {
                        // don't allow backspace to move left of line
                        evt.preventDefault();
                    }
                    // reset tab completion
                    completionNumber=0;
                }
            }
            if(evt.type=='keypress')
            {
                if (evt.code=='Enter')
                {
                    evt.preventDefault();
                    fullLine=promptSpan.innerText;
                    fullLine=fullLine.substring(prompt_text.length)
                    promptSpan.textContent+="\n";
                    //console.log("Got line:"+fullLine)
                    // send line back to callback
                    pyodide_console_area.setAttribute('contenteditable',false);
                    // add to the history if not a duplicate 
                    if(pyodide_history_lines[pyodide_history_lines.length-1]!=fullLine)
                    {
                        // only shift history position if we're on the last one already
                        // or we've typed something new
                        // consistent with standard python interpreter
                        if(pyodide_history_line==pyodide_history_lines.length || fullLine!=pyodide_history_lines[pyodide_history_line])
                        {
                            pyodide_history_line=pyodide_history_lines.length+1;
                        }
                        pyodide_history_lines.push(fullLine);
                    }
                    callback(fullLine);
                    return
                }else
                {
                    completionNumber=0;
                }
            }else if(evt.type=='paste')
            {
                evt.preventDefault()
                txt=evt.clipboardData.getData("text/plain")
                insertPos=eventline_offset+eventline_pos;
                curTxt=promptSpan.innerText
                promptSpan.innerText= [curTxt.slice(0, insertPos), txt, curTxt.slice(insertPos)].join('');
            }else if(evt.type=='mousedown')
            {
                mouseDown=true;
            }
            else if((evt.type=='selectionchange'&& mouseDown==false) || evt.type=='mouseup')
            {
                mouseDown=false;
                if(selection.containsNode(pyodide_console_area,true))
                {
                    if(!mouseDown)
                    {
                        // if we are still in our span then update our cursor position
                        //console.log(evt.type,selection.focusNode);
                        
                        if(selection.focusNode)
                        {
                            if(selection.focusNode.parentElement== promptSpan)
                            {
                                spanOffset=selection.focusOffset;
                                eventline_pos=spanOffset-eventline_offset;
                                if(eventline_pos<0)
                                {
                                    eventline_pos=0;
                                    if(selection.isCollapsed)
                                    {                           
    //                                    selection.collapse(selection.focusNode,eventline_offset);
                                    }
                                }
                                //console.log("Moved in span",eventline_pos);
                            }else
                            {
                                if(selection.isCollapsed)
                                {
                                    // keep cursor in editing span at previous position
                                    selection.collapse(promptSpan.firstChild,eventline_pos+eventline_offset);
                                }
                            }
                        }
                    }
                }
            }else
            {
                //console.log(evt.type);
            }
        }
	}
}

function console_pyodide_load(input_area)
{
	pyodide_console_area=input_area
    input_area.addEventListener("drop", function(evt){evt.preventDefault(); }); // stop people dragging text around in the console
    pyodide_read_arrows_promise = () => new Promise(resolve => pyodide_console_area.addEventListener('keydown', resolve, { once: true,capture:true }));
    pyodide_read_promise = () => new Promise(resolve => pyodide_console_area.addEventListener('keypress', resolve, { once: true,capture:true }));
    pyodide_paste_promise = () => new Promise(resolve => input_area.addEventListener('paste', resolve, { once: true }));
    pyodide_selectionchange_promise = () => new Promise(resolve => document.addEventListener('selectionchange', resolve, { once: true }));
    pyodide_mousedown_promise = () => new Promise(resolve => document.addEventListener('mousedown', resolve, { once: true }));
    pyodide_mouseup_promise = () => new Promise(resolve => document.addEventListener('mouseup', resolve, { once: true }));
    
    pyodide.runPython(`
import js           
import importlib.util
spec = importlib.util.spec_from_loader('pyodide_console', loader=None, origin="pyodide_console.py")
pyodide_console = importlib.util.module_from_spec(spec)
sys.modules['pyodide_console']=pyodide_console		
exec(js.pyodide_console_src, pyodide_console.__dict__)
    `)
    
    
}
