package vn.subifood.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MenuIndexer {
    private static final Logger log=LoggerFactory.getLogger(MenuIndexer.class);
    private final AiSettings settings;private final SupabaseGateway db;private final MenuEmbeddings embeddings;
    public MenuIndexer(AiSettings settings,SupabaseGateway db,MenuEmbeddings embeddings){this.settings=settings;this.db=db;this.embeddings=embeddings;}
    @Scheduled(fixedDelayString="${app.ai.index-delay-ms:60000}",initialDelay=10000)
    public void update(){
        if(!settings.canIndex() || embeddings.quotaPaused())return;
        try {
            int stored=0;for(var source:db.pendingIndex())if(db.store(source,embeddings.document(source.document())))stored++;
            if(stored>0)log.info("AI menu index: updated {} foods",stored);
        }catch(Exception e){log.warn("AI menu indexing unavailable; will retry next cycle ({})",e.getClass().getSimpleName());}
    }
}
