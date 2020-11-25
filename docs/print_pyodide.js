var pyodide_print_area=undefined;

// TODO: make this send messages so it works with web worker
function print_pyodide_stdout(str)
{
	if (pyodide_print_area)
	{
		// this uses a dummy element to convert tag characters quotes etc. to html
		dummy=document.createElement("span");
		dummy.textContent=str;
		pyodide_print_area.innerHTML+=dummy.innerHTML;
	}
}

function print_pyodide_stderr(str)
{
	if (pyodide_print_area)
	{
		// this uses a dummy element to convert tag characters quotes etc. to html
		dummy=document.createElement("span");
		dummy.textContent=str;
		dummy.style="color:#f00;";
		pyodide_print_area.innerHTML+=dummy.outerHTML;
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
