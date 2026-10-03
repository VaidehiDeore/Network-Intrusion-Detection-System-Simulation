from pydantic import BaseModel,Field,ConfigDict
class FlowIn(BaseModel):
    model_config=ConfigDict(extra="allow")
    flow_id:str|None=None; timestamp:str|None=None; source_ip:str; destination_ip:str
    source_port:int=Field(ge=0,le=65535); destination_port:int=Field(ge=0,le=65535); protocol:str
    packet_count:float=Field(ge=0); byte_count:float=Field(ge=0); duration_seconds:float=Field(ge=0)
    connection_count:float=Field(ge=0); failed_connection_count:float=Field(ge=0); syn_count:float=Field(ge=0); rst_count:float=Field(ge=0)
    average_packet_size:float=Field(default=0,ge=0); unique_destination_ports:int=Field(default=1,ge=1); unique_destination_ips:int=Field(default=1,ge=1)
class StatusUpdate(BaseModel): status:str
class NoteIn(BaseModel): note:str=Field(min_length=1,max_length=2000)
