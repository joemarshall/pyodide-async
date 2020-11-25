import inspect
import time
import sys
import bytecode
import dis

class Unraiser(BaseException):
    def __init__(self):
        self.state=inspect.currentframe().f_back
        self.bottomFrame=None
        self.followFrames=[]
        self.thrown=False
        
    def do_throw(self):
        if not self.thrown:
            self.thrown=True
            raise self
        return

    def _frame_needs_rewrite(self,frame,jumpline):
        # disassemble the frame
        # check if the jump line is inside a for loop, try/catch etc.
        # todo cache all the decompilation / fixups
        bytecodes=bytecode.ConcreteByteCode.from_code(frame.f_code)
        blocks=[]
        for pos,bc in enumerate(bytecodes):
            bytePos=pos*2
            print(bc)
            if bc.opcode==dis.opmap["FOR_ITER"]:
                blocks.append(bytePos+bc.arg)
            while len(blocks)>0 and bytePos>=blocks[-1]:
                blocks.pop()
            if bc.lineno==jumpline:
                if len(blocks)>0:
                    return True
                else:
                    return False
        return False
                
    def _rewrite_frame(self,frame):
        # rewrite fn so that it is resumable - needs to
        # have a resume pointer for each call that is made in it
        # these will happen after fn body as new lines in it
        # so once it is all done, can just call set line as normal        
        # 
        # fix for loops so they are resumable with a bytecode jump 
        # old:
        # GET_ITER
        # FOR_ITER offset
        # new:
        # GET_ITER
        # DUP_TOP # duplicate stack top
        # STORE_GLOBAL / LOCAL (to new iteration variable)        # save the iterator object - once per loop
        # FOR_ITER offset # start the loop as normal
        
        # resume for loop = jump to line, push iterator onto stack (inc state)
        bytecodes=bytecode.ConcreteByteCode.from_code(frame.f_code)
        # calls in for
        forCalls=[]
        blocks=[]
        newInstructions=[]
        
        varnames=bytecodes.varnames
        # make the control flow graph
        # so we don't need to deal with jumps, can just stick stuff in
        
        
        for pos,bc in enumerate(bytecodes):
            print(bc)
            if bc.opcode==dis.opmap["FOR_ITER"]:
                thisVar=len(varnames)
                newInstructions.append((ConcreteInstr("DUP_TOP"),None))
                newInstructions.append((ConcreteInstr("STORE_LOCAL",thisVar),None))
                varnames=varnames+["__iter_%d"%thisVar]                
                blocks.append((bytePos+bc.arg,thisVar))
            if bc.opcode==dis.opmap["CALL_FUNCTION"] || bc.opcode==dis.opmap["CALL_FUNCTION_KW"] || bc.opcode==dis.opmap["CALL_FUNCTION_EX"]:
                # call - needs a jump into it
                forCallPushes=[]
                for (pos,thisVar) in blocks:
                    forCallPushes.append(thisVar)                    
                forCalls.append((bytePos,forCallPushes))# this locals need pushing before we go back to the for
            newInstructions.append((bc,bytePos)) # add this instruction
            while len(blocks)>0 and bytePos>=blocks[-1][0]:
                blocks.pop()
            bytePos+=bc.size
        # add jumps at end
        for (target,pushes) in forCalls:
            for c in pushes:
                # load iterator states
                newInstructions.append((ConcreteInstr("LOAD_FAST","__iter_%d"%thisVar),None))
            newInstructions.append((ConcreteInstr("JUMP_ABSOLUTE",target),None))
        # remap byte positions
        
        
        
        # 
        #   
        #
        # fix try/except blocks
        # - make a line for each call in the fn that pushes a block onto the block stack, then jumps to that call
        # 
        # 
        # fix jumping inside a with statement:
        #   make argument of with be a local, so state is kept in the frame
        #   push the __exit__ thingy from the context manager onto the stack
        #   make a jump to the right place        
        # fix jumping inside a for loop:
        #   convert it to:
        # iter = blah
        # while iter.next
        #   
    
        # rewrite the code object so that it uses while instead of for
        # 
        # 
        # code needs to look like:
        #
        # existing code
        # return
        # new bit on the end (outside any blocks)
        # sort out pushing the right things to the stack
        # jump in to the target line
        
                
    def set_caught_at(self):
        self.bottomFrame=inspect.currentframe().f_back
        
    def jumper(self,frame,event,arg):
        try:
            frame.f_lineno=self.newLineNo
            print("Line set",frame)
            return None
        except ValueError:
            print("Couldn't jump directly, need to fixup opcodes")
            self.needsFixup=True
            # make a copy of function and run that instead
            # needs a block of bytecode *after* the return 
            # which a) pushes the right things onto stack
            # b) does absolute jump to be inside any loops
            # c) resets the code object for this frame back to normal?
            return lineTraceFn(frame.f_lineno)                        
        return None
        
    def trace_fn(self,frame,event,arg):
        if len(self.followFrames)==0:
            print("We're back - cleared trace")
            sys.settrace(None)
        elif frame.f_code==self.followFrames[-1].f_code:
            frame.f_code=self.set_caught_at.__code__
            print(frame,event,arg)
            frame.f_code=compile("print('WOO')","Bob.py",'exec')
            frame.f_locals.update(self.followFrames[-1].f_locals)
            self.newLineNo=self.followFrames[-1].f_lineno
            self.newInstructionNo=self.followFrames[-1].f_lasti
#            frame.f_lineno=self.followFrames[-1].f_lineno            
            self.followFrames=self.followFrames[0:-1]
            return self.jumper
        return None
        
    def uncatch(self):
        # find the first thing to run
        self.needsFixup=False
        self.followFrames=[]
        frame=self.state
        lastFrame=frame
        while frame!=self.bottomFrame and frame!=None:
            self.followFrames.append(frame)
            lastFrame=frame
            frame=frame.f_back
        print(lastFrame,self.bottomFrame,frame,self.followFrames)
        sys.settrace(self.trace_fn)
        return catcher(lastFrame.f_code)
       
        
def catcher(fn):
    try:
        exec(fn)
    except Unraiser as u:
        u.set_caught_at()
        return u

        
def mainLoop():
    c=0
    while c<10:
        c+=1
        print(c)
        time.sleep(0.1)
        if c==4:
            x=Unraiser()
            x.do_throw()

def forLoop():
    for c in range(10):
        print(c)
        time.sleep(0.1)
        if c==4:
            x=Unraiser()
            x.do_throw()

        
savedState=catcher(forLoop.__code__)        
savedState.uncatch()