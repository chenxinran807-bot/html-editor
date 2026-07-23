import streamlit as st

st.set_page_config(page_title='Adapter fixture')
st.title('商品列表')
st.button('收藏', key='collect')
st.text_input('搜索商品', key='search')
