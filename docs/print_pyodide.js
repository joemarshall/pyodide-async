var pyodide_print_area=undefined;

// TODO: make this send messages so it works with web worker
function print_pyodide_stdout(str)
{
	if (pyodide_print_area)
	{
        let allLines=str.split("\n")
        for(let c=0;c<allLines.length;c++)
        {
            line=allLines[c];
            lineSpan=document.createElement("span");
            lineSpan.textContent=line;
            if(c<allLines.length-1)
            {
                lineSpan.textContent+="\n";
            }
            pyodide_print_area.appendChild(lineSpan)
            pyodide_print_area.scrollTop = pyodide_print_area.scrollHeight;
        }
	}else
	{
		console.log("Couldn't print:"+str);
	}
}

function print_pyodide_stderr(str)
{
	if (pyodide_print_area)
	{
		// this uses a dummy element to convert tag characters quotes etc. to html
        let allLines=str.split("\n")
        for(let c=0;c<allLines.length;c++)
        {
            line=allLines[c];
            lineSpan=document.createElement("span");
            lineSpan.style="color:#f00;";
            lineSpan.textContent=line;
            if(c<allLines.length-1)
            {
                lineSpan.textContent+="\n";
            }
            pyodide_print_area.appendChild(lineSpan)
            pyodide_print_area.scrollTop = pyodide_print_area.scrollHeight;
        }
	}else
	{
		console.log("Couldn't print:"+str);
	}
}

function print_pyodide_load(print_area,message_object)
{
	pyodide_print_area=print_area;
	pyodide.globals.sys.stdout.write=print_pyodide_stdout;
	pyodide.globals.sys.stderr.write=print_pyodide_stderr;
}
