"""
Generates the Operating Systems question bank and saves it to JSONL format for the KG Builder.
Optionally indexes to OpenSearch.
"""

import argparse
import asyncio
import json
import os
import sys

from loguru import logger

# Add project root to path
sys.path.append(os.getcwd())

from backend.app.core.settings import settings
from backend.app.core.subjects import get_subject
from backend.app.rag.retriever import get_retriever

OS_DATA = [
    {
        "module_id": "process-management",
        "module_title": "Process Management",
        "book_title": "Operating Systems Question Bank",
        "section": "process-management",
        "text": (
            "Question: What is a process in an operating system?\n\n"
            "Answer: A process is an instance of a computer program that is being executed. "
            "It contains the program code and its current activity. A process requires resources such as CPU time, memory, files, and I/O devices to accomplish its task. "
            "The operating system manages processes, including their creation, scheduling, and termination. "
            "Understanding of process states (New, Ready, Running, Waiting, Terminated) is crucial for process management. "
            "A Process Control Block (PCB) is a data structure used by the operating system to store all the information about a process."
        ),
        "key_terms": ["Process", "Process Control Block", "Process Management", "CPU Scheduling"],
    },
    {
        "module_id": "thread-management",
        "module_title": "Thread Management",
        "book_title": "Operating Systems Question Bank",
        "section": "thread-management",
        "text": (
            "Question: How does a thread differ from a process?\n\n"
            "Answer: A thread is a basic unit of CPU utilization, consisting of a thread ID, a program counter, a register set, and a stack. "
            "It is often referred to as a lightweight process. "
            "Threads belonging to the same process share its code section, data section, and other operating-system resources, such as open files and signals. "
            "Because they share resources, creating a thread is less expensive than creating a process. "
            "Multithreading builds on process management."
        ),
        "key_terms": ["Thread", "Multithreading", "Lightweight Process"],
    },
    {
        "module_id": "concurrency",
        "module_title": "Concurrency & Synchronization",
        "book_title": "Operating Systems Question Bank",
        "section": "concurrency",
        "text": (
            "Question: What is the Critical Section Problem, and how is it solved?\n\n"
            "Answer: The critical section problem arises when multiple threads or processes access shared data concurrently, leading to race conditions. "
            "A critical section is a piece of code that accesses a shared resource that must not be concurrently accessed by more than one thread of execution. "
            "To solve this, synchronization mechanisms like Mutex Locks and Semaphores are used. "
            "A semaphore is an integer variable that, apart from initialization, is accessed only through two standard atomic operations: wait() and signal(). "
            "Understanding synchronization is a prerequisite for understanding deadlocks."
        ),
        "key_terms": ["Critical Section", "Race Condition", "Mutex", "Semaphore", "Synchronization"],
    },
    {
        "module_id": "deadlocks",
        "module_title": "Deadlocks",
        "book_title": "Operating Systems Question Bank",
        "section": "deadlocks",
        "text": (
            "Question: What is a deadlock and what are its necessary conditions?\n\n"
            "Answer: A deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process. "
            "Deadlocks can occur if four Coffman conditions hold simultaneously: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. "
            "Operating systems can deal with deadlocks by using Deadlock Prevention, Deadlock Avoidance (e.g., Banker's Algorithm), Deadlock Detection, or simply ignoring them (Ostrich Algorithm)."
        ),
        "key_terms": ["Deadlock", "Mutual Exclusion", "Circular Wait", "Banker's Algorithm"],
    },
    {
        "module_id": "memory-management",
        "module_title": "Memory Management",
        "book_title": "Operating Systems Question Bank",
        "section": "memory-management",
        "text": (
            "Question: Describe paging and how it prevents memory fragmentation.\n\n"
            "Answer: Paging is a memory management scheme that eliminates the need for contiguous allocation of physical memory. "
            "It avoids external fragmentation and the need for compaction. "
            "Physical memory is divided into fixed-sized blocks called frames, and logical memory is divided into blocks of the same size called pages. "
            "When a process is to be executed, its pages are loaded into any available memory frames from their source. "
            "A page table is used to translate logical addresses to physical addresses."
        ),
        "key_terms": ["Memory Management", "Paging", "Fragmentation", "Page Table"],
    },
    {
        "module_id": "virtual-memory",
        "module_title": "Virtual Memory",
        "book_title": "Operating Systems Question Bank",
        "section": "virtual-memory",
        "text": (
            "Question: What is Virtual Memory and how are page faults handled?\n\n"
            "Answer: Virtual Memory is a technique that allows the execution of processes that are not completely in memory. "
            "It abstracts main memory into an extremely large, uniform array of storage, separating logical memory as viewed by the user from physical memory. "
            "This concept builds upon memory management and paging. "
            "When a process tries to access a page that is not currently in physical memory, a page fault occurs. "
            "The operating system must then swap the required page from disk into a free frame in main memory. "
            "Algorithms like LRU (Least Recently Used) and FIFO (First-In, First-Out) are used for Page Replacement."
        ),
        "key_terms": ["Virtual Memory", "Page Fault", "Page Replacement", "Swapping", "LRU"],
    },
    {
        "module_id": "file-systems",
        "module_title": "Storage & File Systems",
        "book_title": "Operating Systems Question Bank",
        "section": "file-systems",
        "text": (
            "Question: Explain the concept of an inode in Unix-like file systems.\n\n"
            "Answer: An inode (index node) is a data structure in a Unix-style file system that describes a file-system object such as a file or a directory. "
            "Each inode stores the attributes and disk block locations of the object's data. "
            "File-system metadata includes ownership, access mode (read, write, execute permissions), and file type. "
            "The file system maintains an array of inodes, and a file's inode number is its index in this array."
        ),
        "key_terms": ["File System", "Inode", "Metadata", "Storage"],
    }
]

def chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    words = text.split()
    chunks = []
    current_chunk = []
    current_count = 0

    for word in words:
        current_chunk.append(word)
        current_count += 1
        if current_count >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_count = 0

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks

async def process_os_data(index_rag: bool = False, subject_id: str = "operating_systems"):
    logger.info(f"Starting OS data ingestion for subject: {subject_id}")
    subject_config = get_subject(subject_id)
    
    os.makedirs(settings.data_processed_dir, exist_ok=True)
    books_jsonl_path = os.path.join(settings.data_processed_dir, f"books_{subject_id}.jsonl")
    
    retriever = get_retriever(subject_id) if index_rag else None
    if retriever:
        try:
            retriever.create_collection(embedding_dim=1024, recreate=False)
        except Exception as e:
            logger.warning(f"Could not create index (may already exist): {e}")

    all_records = []
    
    for item in OS_DATA:
        text = item["text"]
        chunks = chunk_text(text, chunk_size=settings.rag_chunk_size)
        
        record = {
            "module_id": item["module_id"],
            "module_title": item["module_title"],
            "book_title": item["book_title"],
            "section": item["section"],
            "text": text,
            "key_terms": item["key_terms"],
            "chunks": chunks,
            "subject_id": subject_id,
        }
        
        all_records.append(record)
        
        if index_rag and retriever:
            docs = []
            for chunk_idx, chunk in enumerate(chunks):
                docs.append(
                    {
                        "id": f"{subject_id}_{item['module_id']}_chunk_{chunk_idx}",
                        "text": chunk,
                        "module_id": item["module_id"],
                        "module_title": item["module_title"],
                        "section": item["section"],
                        "book": item["book_title"],
                        "key_terms": item["key_terms"],
                        "attribution": subject_config.attribution,
                        "subject_id": subject_id,
                    }
                )
            if docs:
                try:
                    retriever.index_chunks(docs, show_progress=False)
                except Exception as e:
                    logger.error(f"Failed to index {item['module_id']}: {e}")

    logger.info(f"Saving {len(all_records)} records to {books_jsonl_path}")
    with open(books_jsonl_path, "w", encoding="utf-8") as f:
        for record in all_records:
            record_copy = record.copy()
            del record_copy["chunks"]
            f.write(json.dumps(record_copy) + "\n")

    logger.success(f"Ingestion complete for {subject_id}! Processed {len(all_records)} modules.")

def parse_args():
    parser = argparse.ArgumentParser(description="Ingest OS content into the knowledge graph.")
    parser.add_argument("--index-rag", action="store_true", help="Index content into OpenSearch for RAG retrieval.")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(process_os_data(index_rag=args.index_rag))
