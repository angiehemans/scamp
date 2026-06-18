export function useListField(getList, setList) {
    return {
        update: (index, patch) => setList(getList().map((item, i) => (i === index ? { ...item, ...patch } : item))),
        remove: (index) => setList(getList().filter((_, i) => i !== index)),
        add: (item) => setList([...getList(), item]),
    };
}
