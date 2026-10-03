import numpy as np
KEYS=["packets_per_second","bytes_per_second","connection_rate","failure_ratio","unique_destination_ports"]
class Baseline:
    def __init__(self,means=None,stds=None): self.means=means or {}; self.stds=stds or {}
    @classmethod
    def from_records(cls,rs):
        m={}; s={}
        for k in KEYS:
            v=np.array([float(x.get(k,0)) for x in rs],dtype=float); m[k]=float(v.mean()) if len(v) else 0; s[k]=float(v.std()) if len(v) else 1; s[k]=max(s[k],1e-9)
        return cls(m,s)
    def score(self,f):
        z=[min(abs((float(f.get(k,0))-self.means.get(k,0))/self.stds.get(k,1)),10) for k in KEYS]
        return round(min(100,float(np.mean(z))/5*100),2)
